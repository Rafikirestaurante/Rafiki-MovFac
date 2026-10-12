begin;
-- Revisar y probar en staging antes de producción. No asigna datos a un propietario arbitrario.
update public.processing_errors e set workspace_id=r.workspace_id
from public.gmail_sync_runs r where e.sync_run_id=r.id and e.workspace_id is distinct from r.workspace_id;
update public.gmail_integration_audit a set workspace_id=w.id
from public.workspaces w where a.workspace_id is null and a.user_id=w.owner_user_id;

-- Reemplazar solamente las restricciones globales conocidas; una colisión real aborta la transacción.
alter table public.financial_movements drop constraint if exists financial_movements_gmail_message_id_movement_type_key;
create unique index if not exists financial_movements_workspace_message_type_unique on public.financial_movements(workspace_id,gmail_message_id,movement_type);
drop index if exists public.electronic_invoices_cufe_unique;
drop index if exists public.electronic_invoices_supplier_number_unique;
drop index if exists public.electronic_invoices_document_key_unique;
create unique index if not exists electronic_invoices_workspace_cufe_unique on public.electronic_invoices(workspace_id,cufe) where cufe is not null and length(trim(cufe))>0;
create unique index if not exists electronic_invoices_workspace_number_unique on public.electronic_invoices(workspace_id,supplier_tax_id,invoice_number) where length(trim(supplier_tax_id))>0 and length(trim(invoice_number))>0;
create unique index if not exists electronic_invoices_workspace_document_unique on public.electronic_invoices(workspace_id,document_key) where document_key is not null and length(trim(document_key))>0;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u join auth.users a on a.id=u.id
 where u.id=auth.uid() and u.role='platform_admin' and u.status='active' and lower(a.email)='rafiki.restaurante@gmail.com');
$$;
drop policy if exists phase5f_authorizations_boundary on public.authorized_users;
create policy phase5f_authorizations_boundary on public.authorized_users as restrictive for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists phase5f_profile_write_boundary on public.app_users;
create policy phase5f_profile_write_boundary on public.app_users as restrictive for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
-- El registro histórico puede contener valores de otros espacios. No exponerlo al navegador.
drop policy if exists phase5f_audit_boundary on public.document_audit_log;
create policy phase5f_audit_boundary on public.document_audit_log as restrictive for all to authenticated using(false) with check(false);

create or replace function public.workspace_access_allowed(p_workspace uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_users u join public.workspace_members m on m.user_id=u.id
 join public.workspaces w on w.id=m.workspace_id join auth.users a on a.id=u.id
 where u.id=auth.uid() and u.status='active' and w.status='active' and w.id=p_workspace
 and ((lower(a.email)='rafiki.restaurante@gmail.com' and u.role='platform_admin') or exists(select 1 from public.authorized_users au where lower(au.email)=lower(a.email) and au.status='active')));
$$;
revoke all on function public.workspace_access_allowed(uuid) from public,anon;
grant execute on function public.workspace_access_allowed(uuid) to authenticated;

-- Restrictive policies constrain even legacy permissive admin policies.
do $$ declare t text; begin
 foreach t in array array['financial_movements','electronic_invoices','daily_verifications','gmail_sync_runs','gmail_sync_candidates','processing_errors','gmail_integration_audit','gmail_connections'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists phase5f_workspace_boundary on public.%I',t);
  execute format('create policy phase5f_workspace_boundary on public.%I as restrictive for all to authenticated using (public.workspace_access_allowed(workspace_id)) with check (public.workspace_access_allowed(workspace_id))',t);
 end loop;
end $$;
-- Tokens are available only through authenticated Edge Functions using service role.
revoke all on public.gmail_connections from anon,authenticated;

create table if not exists public.workspace_preferences (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 banks text[] not null default array['bancolombia']::text[],
 updated_at timestamptz not null default now(),
 constraint workspace_preferences_valid_banks check(cardinality(banks)>0 and banks <@ array['bancolombia','nequi']::text[])
);
alter table public.workspace_preferences enable row level security;
revoke all on public.workspace_preferences from anon,authenticated;
grant all on public.workspace_preferences to service_role;
create or replace function public.get_workspace_banks()
returns text[] language plpgsql security definer set search_path=pg_catalog,public as $$
declare ws uuid; banks_value text[]; begin
 select w.id into ws from public.workspaces w join public.app_users u on u.id=w.owner_user_id
 where w.owner_user_id=auth.uid() and public.workspace_access_allowed(w.id) and w.status='active' and u.status='active' and u.role in ('platform_admin','workspace_owner','admin');
 if ws is null then raise exception 'No existe workspace propio activo'; end if;
 select banks into banks_value from public.workspace_preferences where workspace_id=ws;
 return coalesce(banks_value,array['bancolombia']::text[]);
end $$;
create or replace function public.set_workspace_banks(p_banks text[])
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare ws uuid; begin
 if p_banks is null or cardinality(p_banks)=0 or array_position(p_banks,null) is not null or not p_banks <@ array['bancolombia','nequi']::text[] then raise exception 'Selecciona bancos válidos'; end if;
 select w.id into ws from public.workspaces w join public.app_users u on u.id=w.owner_user_id
 where w.owner_user_id=auth.uid() and public.workspace_access_allowed(w.id) and w.status='active' and u.status='active' and u.role in ('platform_admin','workspace_owner','admin');
 if ws is null then raise exception 'No existe workspace propio activo'; end if;
 insert into public.workspace_preferences(workspace_id,banks) values(ws,p_banks)
 on conflict(workspace_id) do update set banks=excluded.banks,updated_at=now();
end $$;
revoke all on function public.get_workspace_banks() from public,anon;
revoke all on function public.set_workspace_banks(text[]) from public,anon;
grant execute on function public.get_workspace_banks() to authenticated;
grant execute on function public.set_workspace_banks(text[]) to authenticated;

-- One transaction serializes the check and creation for each workspace, across both sync endpoints.
create or replace function public.begin_workspace_sync(p_workspace uuid,p_user uuid,p_detail jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare active_id bigint; new_id bigint; begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo servicio'; end if;
 perform 1 from public.workspaces where id=p_workspace and owner_user_id=p_user and status='active' for update;
 if not found then raise exception 'Workspace inválido'; end if;
 select id into active_id from public.gmail_sync_runs where workspace_id=p_workspace and status='running' and started_at >= now()-interval '30 minutes' order by started_at desc limit 1;
 if active_id is not null then return jsonb_build_object('busy',true,'id',active_id); end if;
 update public.gmail_sync_runs set status='error',finished_at=now(),errors_count=coalesce(errors_count,0)+1,
 detail=coalesce(detail,'{}'::jsonb)||jsonb_build_object('interrupted',true,'reason','Ejecución sin cierre durante más de 30 minutos')
 where workspace_id=p_workspace and status='running';
 insert into public.gmail_sync_runs(workspace_id,trigger_type,status,requested_by,detail)
 values(p_workspace,'manual','running',p_user,p_detail) returning id into new_id;
 return jsonb_build_object('busy',false,'id',new_id);
end $$;
revoke all on function public.begin_workspace_sync(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_workspace_sync(uuid,uuid,jsonb) to service_role;
-- Sustituye triggers históricos que aún buscaban role=admin tras el cambio de roles.
create or replace function public.phase5f_provision_user() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare ws uuid; email_value text:=lower(trim(coalesce(new.email,''))); assigned_role text; begin
 if email_value='rafiki.restaurante@gmail.com' then assigned_role:='platform_admin';
 else
  if not exists(select 1 from public.authorized_users where lower(email)=email_value and status='active') then raise exception 'Correo no autorizado para Rafiki'; end if;
  assigned_role:='workspace_owner';
 end if;
 insert into public.app_users(id,email,display_name,role,status) values(new.id,email_value,coalesce(new.raw_user_meta_data->>'display_name',''),assigned_role,'active') on conflict(id) do nothing;
 insert into public.workspaces(owner_user_id,name) values(new.id,'Mi espacio Rafiki') on conflict(owner_user_id) do nothing;
 select id into ws from public.workspaces where owner_user_id=new.id;
 insert into public.workspace_members(workspace_id,user_id,role) values(ws,new.id,'owner') on conflict(workspace_id,user_id) do nothing;
 return new;
end $$;
revoke all on function public.phase5f_provision_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_documental on auth.users;
drop trigger if exists on_auth_user_created_workspace on auth.users;
drop trigger if exists promote_authorized_workspace_owner on auth.users;
drop trigger if exists phase5f_on_auth_user_created on auth.users;
create trigger phase5f_on_auth_user_created after insert on auth.users for each row execute function public.phase5f_provision_user();

create or replace function public.workspace_sync_diagnostic()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare ws uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 if not exists(select 1 from public.app_users where id=auth.uid() and status='active') then raise exception 'Usuario inactivo'; end if;
 select id into ws from public.workspaces where owner_user_id=auth.uid() and status='active';
 if ws is null or not public.workspace_access_allowed(ws) then raise exception 'No existe un workspace propio autorizado activo'; end if;
 select jsonb_build_object('checked_at',now(),'runs',coalesce((
 select jsonb_agg(to_jsonb(r)) from (select id,status,started_at,finished_at,messages_scanned,movements_created,invoices_created,duplicates_ignored,errors_count
 from public.gmail_sync_runs where workspace_id=ws order by started_at desc limit 10) r),'[]'::jsonb),
 'errors',coalesce((select jsonb_agg(to_jsonb(e)) from (
 select e.id,e.sync_run_id,e.created_at,e.source,e.stage,e.error_message
 from public.processing_errors e join public.gmail_sync_runs r on r.id=e.sync_run_id
 where r.workspace_id=ws order by e.created_at desc limit 100) e),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.workspace_sync_diagnostic() from public,anon;
grant execute on function public.workspace_sync_diagnostic() to authenticated;

notify pgrst,'reload schema';
commit;
