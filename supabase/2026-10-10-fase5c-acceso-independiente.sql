-- Fase 5C. Ejecutar solo después de 5A/5B en staging y con respaldo.
begin;
create or replace function public.provision_authorized_workspace()
returns trigger language plpgsql security definer set search_path=public as $$
declare ws uuid; email_value text := lower(trim(coalesce(new.email,'')));
begin
  if exists(select 1 from public.app_users where role='admin' and status='active')
     and not exists(select 1 from public.authorized_users where email=email_value and status='active') then
    raise exception 'Este correo no esta autorizado para utilizar Rafiki MF';
  end if;
  insert into public.app_users(id,email,display_name,role,status)
    values(new.id,email_value,trim(coalesce(new.raw_user_meta_data->>'display_name','')),'workspace_owner','active')
    on conflict(id) do nothing;
  insert into public.workspaces(owner_user_id,name) values(new.id,'Mi espacio Rafiki') on conflict(owner_user_id) do nothing returning id into ws;
  if ws is null then select id into ws from public.workspaces where owner_user_id=new.id; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(ws,new.id,'owner') on conflict do nothing;
  update public.authorized_users set last_access_at=now(), updated_at=now() where email=email_value and status='active';
  return new;
end; $$;
drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace after insert on auth.users for each row execute function public.provision_authorized_workspace();
drop policy if exists authorized_users_select_self on public.authorized_users;
create policy authorized_users_select_self on public.authorized_users for select to authenticated using (lower(email)=lower((select email from auth.users where id=auth.uid())) or public.is_platform_admin());
commit;
-- Rollback: drop trigger on_auth_user_created_workspace; restore previous handle_new_app_user trigger/function; drop policy authorized_users_select_self.
