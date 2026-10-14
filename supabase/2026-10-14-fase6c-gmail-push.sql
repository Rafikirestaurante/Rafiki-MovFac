begin;
create table if not exists public.gmail_push_state (
 workspace_id uuid primary key references public.workspaces(id), owner_user_id uuid not null,
 google_email text not null, enabled boolean not null default false,
 movements boolean not null default true, invoices boolean not null default false,
 cursor_id text, watch_expiration timestamptz, last_notification_at timestamptz,
 pending boolean not null default true, page_state jsonb not null default '{}',
 lease uuid, lease_until timestamptz, next_attempt_at timestamptz not null default now(),
 last_checked_at timestamptz, last_completed_at timestamptz, last_error text,
 updated_at timestamptz not null default now()
);
alter table public.gmail_push_state enable row level security;
revoke all on public.gmail_push_state from public,anon,authenticated;
grant all on public.gmail_push_state to service_role;

create or replace function public.invalidate_gmail_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from 'connected' or lower(new.google_email) is distinct from lower(old.google_email) then
  update gmail_push_state set enabled=false,lease=null,lease_until=null,page_state='{}',last_error='La conexión Gmail cambió o fue desconectada.' where workspace_id=new.workspace_id;
 end if;
 return new;
end $$;
revoke all on function public.invalidate_gmail_push() from public,anon,authenticated;
drop trigger if exists gmail_push_connection_changed on public.gmail_connections;
create trigger gmail_push_connection_changed after update of status,google_email on public.gmail_connections for each row execute function public.invalidate_gmail_push();

create or replace function public.configure_gmail_push(p_workspace uuid,p_user uuid,p_email text,p_movements boolean,p_invoices boolean,p_cursor text,p_expiration timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare old_state gmail_push_state;
begin
 if not (p_movements or p_invoices) or p_cursor !~ '^[0-9]{1,30}$' or p_expiration<=now() then raise exception 'Configuración push inválida'; end if;
 perform 1 from workspaces where id=p_workspace and owner_user_id=p_user and status='active' for update;
 if not found then raise exception 'Workspace no disponible'; end if;
 perform 1 from gmail_connections where workspace_id=p_workspace and owner_user_id=p_user and lower(google_email)=lower(p_email) and status='connected';
 if not found then raise exception 'La conexión Gmail cambió durante la activación'; end if;
 select * into old_state from gmail_push_state where workspace_id=p_workspace for update;
 if old_state.lease_until>now() then raise exception 'Espera a que termine el lote push antes de cambiarlo'; end if;
 if not coalesce(old_state.enabled,false) and exists(select 1 from gmail_sync_jobs where workspace_id=p_workspace and not completed and request->>'source'='gmail-push') then
  raise exception 'Continúa o cancela el lote pendiente desde Configuración antes de reactivar push';
 end if;
 insert into gmail_push_state(workspace_id,owner_user_id,google_email,enabled,movements,invoices,cursor_id,watch_expiration,pending)
 values(p_workspace,p_user,lower(p_email),true,p_movements,p_invoices,p_cursor,p_expiration,true)
 on conflict(workspace_id) do update set
 owner_user_id=p_user,google_email=lower(p_email),enabled=true,movements=p_movements,invoices=p_invoices,
 cursor_id=case when old_state.enabled and old_state.google_email=lower(p_email) then old_state.cursor_id else p_cursor end,
 page_state=case when old_state.enabled and old_state.google_email=lower(p_email) then old_state.page_state else '{}'::jsonb end,
 watch_expiration=p_expiration,pending=true,lease=null,lease_until=null,last_error=null,next_attempt_at=now(),updated_at=now();
end $$;
revoke all on function public.configure_gmail_push(uuid,uuid,text,boolean,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.configure_gmail_push(uuid,uuid,text,boolean,boolean,text,timestamptz) to service_role;

create or replace function public.receive_gmail_push(p_email text,p_history text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_history !~ '^[0-9]{1,30}$' then raise exception 'Historial inválido'; end if;
 update gmail_push_state set last_notification_at=now(),pending=true,next_attempt_at=least(next_attempt_at,now()),updated_at=now()
 where enabled and google_email=lower(p_email) and (cursor_id is null or p_history::numeric>cursor_id::numeric);
end $$;

create or replace function public.claim_gmail_push(p_workspace uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s gmail_push_state; token uuid:=gen_random_uuid();
begin
 select ps.* into s from gmail_push_state ps
 join workspaces w on w.id=ps.workspace_id and w.owner_user_id=ps.owner_user_id and w.status='active'
 join gmail_connections c on c.workspace_id=ps.workspace_id and c.owner_user_id=ps.owner_user_id and c.status='connected' and lower(c.google_email)=ps.google_email
 where ps.enabled and (p_workspace is null or ps.workspace_id=p_workspace)
 and (ps.lease_until is null or ps.lease_until<now()) and ps.next_attempt_at<=now()
 and (ps.pending or ps.last_checked_at is null or ps.last_checked_at<now()-interval '15 minutes'
 or ps.watch_expiration is null or ps.watch_expiration<now()+interval '48 hours')
 order by ps.next_attempt_at for update of ps skip locked limit 1;
 if not found then return null; end if;
 update gmail_push_state set lease=token,lease_until=now()+interval '5 minutes' where workspace_id=s.workspace_id;
 return to_jsonb(s)||jsonb_build_object('lease',token);
end $$;

create or replace function public.save_gmail_push(p_workspace uuid,p_lease uuid,p_patch jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 update gmail_push_state set
 cursor_id=coalesce(p_patch->>'cursor_id',cursor_id),
 page_state=coalesce(p_patch->'page_state',page_state),
 watch_expiration=coalesce((p_patch->>'watch_expiration')::timestamptz,watch_expiration),
 pending=case when p_patch ? 'pending' then (p_patch->>'pending')::boolean or coalesce(last_notification_at>(p_patch->>'started_at')::timestamptz,false) else pending end,
 last_checked_at=coalesce((p_patch->>'last_checked_at')::timestamptz,last_checked_at),
 last_completed_at=coalesce((p_patch->>'last_completed_at')::timestamptz,last_completed_at),
 last_error=p_patch->>'last_error',next_attempt_at=coalesce((p_patch->>'next_attempt_at')::timestamptz,now()),
 lease=null,lease_until=null,updated_at=now()
 where workspace_id=p_workspace and lease=p_lease and lease_until>now() and enabled;
 if not found then raise exception 'La reserva push venció o fue desactivada'; end if;
end $$;
revoke all on function public.receive_gmail_push(text,text),public.claim_gmail_push(uuid),public.save_gmail_push(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.receive_gmail_push(text,text),public.claim_gmail_push(uuid),public.save_gmail_push(uuid,uuid,jsonb) to service_role;
create or replace function public.workspace_release_health()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare ws uuid; checks jsonb:='[]'; t text; ok boolean; fn text; proc regprocedure;
begin
 select id into ws from public.workspaces where owner_user_id=auth.uid() and status='active' and public.workspace_access_allowed(id);
 if ws is null then raise exception 'Workspace autorizado no disponible'; end if;
 foreach t in array array['financial_movements','electronic_invoices','gmail_sync_runs','gmail_sync_candidates','processing_errors','gmail_integration_audit'] loop
  select coalesce(c.relrowsecurity,false) and exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='phase5f_workspace_boundary' and not p.polpermissive)
   into ok from pg_class c where c.oid=to_regclass('public.'||t);
  checks:=checks || jsonb_build_array(jsonb_build_object('key','isolation_'||t,'ok',coalesce(ok,false)));
 end loop;
 foreach t in array array['gmail_connections','gmail_oauth_states','gmail_sync_jobs','gmail_push_state'] loop
  select not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
   and not has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
   and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
   and not has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') into ok from pg_class c where c.oid=to_regclass('public.'||t);
  checks:=checks || jsonb_build_array(jsonb_build_object('key','private_'||t,'ok',coalesce(ok,false)));
 end loop;
 foreach fn in array array['public.claim_sync_batch(uuid,uuid,text,jsonb,bigint)','public.save_sync_batch(bigint,uuid,jsonb,boolean,boolean)'] loop
  proc:=to_regprocedure(fn);
  ok:=case when proc is null then false else not has_function_privilege('authenticated',proc,'EXECUTE') and not has_function_privilege('anon',proc,'EXECUTE') end;
  checks:=checks || jsonb_build_array(jsonb_build_object('key',case when fn like '%claim_%' then 'batch_claim' else 'batch_save' end,'ok',ok));
 end loop;
 proc:=to_regprocedure('public.workspace_movement_report(date,date,text,text,text,numeric,numeric,integer,integer)');
 select not prosecdef into ok from pg_proc where oid=proc;
 checks:=checks || jsonb_build_array(jsonb_build_object('key','report_session','ok',coalesce(ok,false)));
 select exists(select 1 from pg_index where indexrelid=to_regclass('public.financial_movements_workspace_message_type_unique') and indisunique and indisvalid) into ok;
 checks:=checks || jsonb_build_array(jsonb_build_object('key','movement_dedup','ok',ok));
 return jsonb_build_object('schema_version','1.12.0','checked_at',now(),'checks',checks,
 'ok',not exists(select 1 from jsonb_array_elements(checks) c where not (c->>'ok')::boolean));
end $$;
revoke all on function public.workspace_release_health() from public,anon;
grant execute on function public.workspace_release_health() to authenticated;

notify pgrst,'reload schema';
commit;

