-- Aplicar en staging con respaldo. No asignar registros históricos sin evidencia.
begin;
alter table public.gmail_sync_candidates add column if not exists workspace_id uuid references public.workspaces(id);
update public.gmail_sync_candidates c set workspace_id=r.workspace_id
from public.gmail_sync_runs r where c.sync_run_id=r.id and c.workspace_id is null and r.workspace_id is not null;
alter table public.gmail_sync_candidates drop constraint if exists gmail_sync_candidates_gmail_message_id_key;
create unique index if not exists gmail_sync_candidates_workspace_message_unique on public.gmail_sync_candidates(workspace_id,gmail_message_id);
alter table public.financial_movements drop constraint if exists financial_movements_gmail_message_id_movement_type_key;
create unique index if not exists financial_movements_workspace_message_type_unique on public.financial_movements(workspace_id,gmail_message_id,movement_type);
commit;
