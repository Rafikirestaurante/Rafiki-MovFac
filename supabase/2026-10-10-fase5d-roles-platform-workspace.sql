-- Roles 5D: un administrador de plataforma y propietarios financieros por workspace.
-- Ejecutar con respaldo y probar en staging.
begin;
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in ('platform_admin','workspace_owner','reviewer'));
update public.app_users set role='workspace_owner' where role='admin';
update public.app_users set role='platform_admin', updated_at=now()
where lower(email)=lower('rafiki.restaurante@gmail.com');
update public.app_users set role='workspace_owner', updated_at=now()
where lower(email)<>lower('rafiki.restaurante@gmail.com') and role='platform_admin';
create unique index if not exists one_platform_admin_only on public.app_users((role)) where role='platform_admin';
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.app_users where id=auth.uid() and role='platform_admin' and status='active');
$$;
create or replace function public.is_workspace_owner() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.app_users where id=auth.uid() and role in ('workspace_owner') and status='active');
$$;
-- Compatibilidad con el trigger histórico que crea primero el perfil como reviewer.
create or replace function public.promote_new_workspace_owner()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(coalesce(new.email,'')) <> lower('rafiki.restaurante@gmail.com') then
    update public.app_users set role='workspace_owner', updated_at=now()
    where id=new.id and role='reviewer';
  end if;
  return new;
end; $$;
drop trigger if exists promote_authorized_workspace_owner on auth.users;
create trigger promote_authorized_workspace_owner after insert on auth.users for each row execute function public.promote_new_workspace_owner();
commit;
-- Nota: el trigger de provisionamiento debe asignar workspace_owner a usuarios autorizados.
-- Rollback: restaurar roles admin/reviewer y eliminar one_platform_admin_only.

