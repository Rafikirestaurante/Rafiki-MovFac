-- Fase 5D / 1.8.0. Preparación de Gmail por workspace. No ejecutar en producción.
begin;
alter table public.gmail_connections add column if not exists workspace_id uuid;
do $$ declare first_workspace uuid; begin
  select id into first_workspace from public.workspaces order by created_at limit 1;
  update public.gmail_connections set workspace_id=first_workspace where workspace_id is null and first_workspace is not null;
end $$;
alter table public.gmail_connections drop constraint if exists gmail_connections_workspace_fk;
alter table public.gmail_connections add constraint gmail_connections_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
create unique index if not exists gmail_connections_workspace_unique on public.gmail_connections(workspace_id) where workspace_id is not null;
create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path=public as $$
  select workspace_id from public.workspace_members where user_id=auth.uid() order by created_at limit 1;
$$;
grant execute on function public.current_workspace_id() to authenticated;
alter table public.gmail_connections enable row level security;
drop policy if exists gmail_connections_workspace_self on public.gmail_connections;
create policy gmail_connections_workspace_self on public.gmail_connections for select to authenticated using (workspace_id=public.current_workspace_id());
commit;
-- Antes de producción: actualizar OAuth callback/status/diagnostics/disconnect/test y ambas
-- sincronizaciones para filtrar por current_workspace_id y nunca usar solo connection_key.
-- Rollback: eliminar la política, índice, función y columna workspace_id tras restaurar respaldo.
