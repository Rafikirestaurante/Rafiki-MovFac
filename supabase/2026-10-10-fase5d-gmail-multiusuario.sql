-- Fase 5D / paso 1: separar conexiones Gmail por workspace.
-- No ejecutar en producción. Requiere respaldo y validación de las Edge Functions.
begin;
alter table public.gmail_connections add column if not exists workspace_id uuid;
do $$ declare ws uuid; owner uuid; begin
  select id, owner_user_id into ws, owner from public.workspaces order by created_at limit 1;
  if ws is not null then update public.gmail_connections set workspace_id=ws where workspace_id is null; end if;
end $$;
alter table public.gmail_connections drop constraint if exists gmail_connections_pkey;
alter table public.gmail_connections add constraint gmail_connections_pkey primary key (workspace_id);
alter table public.gmail_connections add constraint gmail_connections_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade;
alter table public.gmail_connections drop constraint if exists gmail_connections_connection_key_check;
alter table public.gmail_connections add constraint gmail_connections_connection_key_check check (connection_key='principal');
create index if not exists gmail_connections_owner_idx on public.gmail_connections(owner_user_id);
alter table public.gmail_connections enable row level security;
drop policy if exists gmail_connections_workspace_self on public.gmail_connections;
create policy gmail_connections_workspace_self on public.gmail_connections for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
-- Las Edge Functions usan service role para tokens y escrituras.
commit;
-- Siguiente paso obligatorio: adaptar OAuth callback, status, diagnostics, disconnect,
-- sync-now, sync-invoices y test-connection para resolver workspace_id por auth.uid().
-- Rollback: restaurar la PK connection_key y eliminar workspace_id después de respaldar.
