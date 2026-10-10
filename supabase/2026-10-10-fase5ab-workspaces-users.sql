-- Fase 5A/5B: migración aditiva, no ejecutar automáticamente.
-- 1) Hacer respaldo de las tablas afectadas antes de ejecutar.
begin;
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null default 'Mi espacio Rafiki',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table if not exists public.authorized_users (
  id uuid primary key default gen_random_uuid(), email text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  authorized_by uuid not null references auth.users(id) on delete restrict,
  authorized_at timestamptz not null default now(), last_access_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.financial_movements add column if not exists workspace_id uuid;
alter table public.electronic_invoices add column if not exists workspace_id uuid;
alter table public.daily_verifications add column if not exists workspace_id uuid;
alter table public.gmail_sync_runs add column if not exists workspace_id uuid;
alter table public.processing_errors add column if not exists workspace_id uuid;
alter table public.gmail_integration_audit add column if not exists workspace_id uuid;
do $$ declare owner uuid; ws uuid; begin
  select id into owner from auth.users order by created_at,id limit 1;
  if owner is not null then
    insert into public.workspaces(owner_user_id) values(owner) on conflict(owner_user_id) do nothing;
    select id into ws from public.workspaces where owner_user_id=owner;
    insert into public.workspace_members(workspace_id,user_id,role) values(ws,owner,'owner') on conflict do nothing;
    update public.financial_movements set workspace_id=ws where workspace_id is null;
    update public.electronic_invoices set workspace_id=ws where workspace_id is null;
    update public.daily_verifications set workspace_id=ws where workspace_id is null;
    update public.gmail_sync_runs set workspace_id=ws where workspace_id is null;
    update public.processing_errors set workspace_id=ws where workspace_id is null;
    update public.gmail_integration_audit set workspace_id=ws where workspace_id is null;
  end if;
end $$;
alter table public.financial_movements add constraint financial_movements_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade not valid;
alter table public.electronic_invoices add constraint electronic_invoices_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade not valid;
create index if not exists financial_movements_workspace_idx on public.financial_movements(workspace_id);
create index if not exists electronic_invoices_workspace_idx on public.electronic_invoices(workspace_id);
create or replace function public.my_workspace_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select workspace_id from public.workspace_members where user_id=auth.uid(); $$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.is_app_admin(); $$;
alter table public.workspaces enable row level security; alter table public.workspace_members enable row level security; alter table public.authorized_users enable row level security;
drop policy if exists workspace_member_select on public.workspaces; create policy workspace_member_select on public.workspaces for select to authenticated using (id in (select public.my_workspace_ids()));
drop policy if exists workspace_members_self on public.workspace_members; create policy workspace_members_self on public.workspace_members for select to authenticated using (user_id=auth.uid());
drop policy if exists authorized_users_admin on public.authorized_users; create policy authorized_users_admin on public.authorized_users for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists financial_movements_workspace_select on public.financial_movements; create policy financial_movements_workspace_select on public.financial_movements for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
drop policy if exists electronic_invoices_workspace_select on public.electronic_invoices; create policy electronic_invoices_workspace_select on public.electronic_invoices for select to authenticated using (workspace_id in (select public.my_workspace_ids()));
drop policy if exists financial_movements_workspace_write on public.financial_movements; create policy financial_movements_workspace_write on public.financial_movements for all to authenticated using (workspace_id in (select public.my_workspace_ids())) with check (workspace_id in (select public.my_workspace_ids()));
drop policy if exists electronic_invoices_workspace_write on public.electronic_invoices; create policy electronic_invoices_workspace_write on public.electronic_invoices for all to authenticated using (workspace_id in (select public.my_workspace_ids())) with check (workspace_id in (select public.my_workspace_ids()));
commit;
-- Rollback manual (después de respaldo): drop policies nuevas; drop columns workspace_id; drop tables authorized_users, workspace_members, workspaces.
