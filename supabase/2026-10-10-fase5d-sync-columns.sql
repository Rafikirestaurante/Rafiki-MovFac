begin;
alter table public.gmail_sync_runs add column if not exists workspace_id uuid;
alter table public.processing_errors add column if not exists workspace_id uuid;
alter table public.gmail_integration_audit add column if not exists workspace_id uuid;
update public.gmail_sync_runs r set workspace_id=w.id from public.workspaces w where r.workspace_id is null and w.owner_user_id=r.requested_by;
update public.processing_errors e set workspace_id=r.workspace_id from public.gmail_sync_runs r where e.workspace_id is null and e.sync_run_id=r.id;
update public.gmail_integration_audit a set workspace_id=w.id from public.workspaces w where a.workspace_id is null and w.owner_user_id=a.user_id;
alter table public.gmail_sync_runs add constraint gmail_sync_runs_workspace_fk foreign key(workspace_id) references public.workspaces(id) on delete cascade not valid;
commit;
