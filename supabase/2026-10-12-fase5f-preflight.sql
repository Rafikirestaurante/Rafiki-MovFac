-- SOLO LECTURA. Ejecutar antes de la migración en la copia/staging.
-- 1. Usuarios que quedarían sin autorización. Revisar la lista; no habilitar automáticamente.
select u.email,u.role,u.status from public.app_users u
where u.status='active' and lower(u.email)<>'rafiki.restaurante@gmail.com'
and not exists(select 1 from public.authorized_users a where lower(a.email)=lower(u.email) and a.status='active');
-- 2. Datos sin workspace (quedarán ocultos; no reasignarlos arbitrariamente).
select 'movimientos' entidad,count(*) sin_workspace from public.financial_movements where workspace_id is null
union all select 'facturas',count(*) from public.electronic_invoices where workspace_id is null
union all select 'ejecuciones',count(*) from public.gmail_sync_runs where workspace_id is null
union all select 'candidatos',count(*) from public.gmail_sync_candidates where workspace_id is null;
-- 3. Conexiones cuyo dueño no coincide con el workspace.
select c.workspace_id,c.owner_user_id,w.owner_user_id workspace_owner from public.gmail_connections c
left join public.workspaces w on w.id=c.workspace_id where c.owner_user_id is distinct from w.owner_user_id;
-- 4. Ejecuciones asignadas a otro propietario: requieren investigar procedencia.
select r.id,r.workspace_id,r.requested_by,w.owner_user_id from public.gmail_sync_runs r
join public.workspaces w on w.id=r.workspace_id where r.requested_by is distinct from w.owner_user_id;
-- 5. Colisiones que impedirían crear índices. No elimina registros.
select workspace_id,gmail_message_id,movement_type,count(*) from public.financial_movements
where workspace_id is not null and gmail_message_id is not null group by 1,2,3 having count(*)>1;
-- 6. Inventario de las políticas y triggers realmente instalados.
select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
select tgname,pg_get_triggerdef(oid) definicion from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal;
