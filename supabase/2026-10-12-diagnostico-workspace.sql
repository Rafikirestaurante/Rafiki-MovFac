begin;
create or replace function public.workspace_sync_diagnostic()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare ws uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 if not exists(select 1 from public.app_users where id=auth.uid() and status='active') then raise exception 'Usuario inactivo'; end if;
 select id into ws from public.workspaces where owner_user_id=auth.uid() and status='active';
 if ws is null then raise exception 'No existe un workspace propio activo'; end if;
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
commit;
-- Reversión: drop function public.workspace_sync_diagnostic();
