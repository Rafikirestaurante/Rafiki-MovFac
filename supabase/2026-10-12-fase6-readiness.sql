begin;
-- Evita administración de perfiles, membresías y credenciales desde clientes antiguos.
do $$ declare t text; cols text; begin
 foreach t in array array['app_users','authorized_users','workspaces','workspace_members','financial_movements','electronic_invoices','daily_verifications','gmail_sync_runs','gmail_sync_candidates','processing_errors','gmail_integration_audit','gmail_connections','gmail_oauth_states','gmail_sync_jobs','workspace_preferences'] loop
  if to_regclass('public.'||t) is not null then
   execute format('revoke all on public.%I from public,anon',t);
   select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
   execute format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public,anon',cols,cols,cols,cols,t);
  end if;
 end loop;
 foreach t in array array['gmail_connections','gmail_oauth_states','gmail_sync_jobs'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
   execute format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
   execute format('grant all on public.%I to service_role',t);
  end if;
 end loop;
 foreach t in array array['workspaces','workspace_members'] loop
  select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.%I from authenticated',cols,cols,cols,t);
 end loop;
 select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid='public.app_users'::regclass and attnum>0 and not attisdropped;
 execute format('revoke insert (%s), references (%s) on public.app_users from authenticated',cols,cols);
end $$;
revoke insert,delete on public.app_users from authenticated;
revoke insert,update,delete on public.workspaces,public.workspace_members from authenticated;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
drop policy if exists phase6_own_profile on public.app_users;
create policy phase6_own_profile on public.app_users as restrictive for select to authenticated using(id=auth.uid() or public.is_platform_admin());
drop policy if exists phase6_own_workspace on public.workspaces;
create policy phase6_own_workspace on public.workspaces as restrictive for select to authenticated using(owner_user_id=auth.uid());
drop policy if exists phase6_own_membership on public.workspace_members;
create policy phase6_own_membership on public.workspace_members as restrictive for select to authenticated using(user_id=auth.uid());

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
 foreach t in array array['gmail_connections','gmail_oauth_states','gmail_sync_jobs'] loop
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
 return jsonb_build_object('schema_version','1.11.0','checked_at',now(),'checks',checks,
 'ok',not exists(select 1 from jsonb_array_elements(checks) c where not (c->>'ok')::boolean));
end $$;
revoke all on function public.workspace_release_health() from public,anon;
grant execute on function public.workspace_release_health() to authenticated;
notify pgrst,'reload schema';
commit;


