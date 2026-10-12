begin;
create table if not exists public.gmail_sync_jobs (
 run_id bigint primary key references public.gmail_sync_runs(id),
 workspace_id uuid not null references public.workspaces(id),
 user_id uuid not null, kind text not null, request jsonb not null,
 state jsonb not null default '{}', lease uuid, lease_until timestamptz,
 updated_at timestamptz not null default now(), completed boolean not null default false
);
alter table public.gmail_sync_jobs enable row level security;
revoke all on public.gmail_sync_jobs from anon, authenticated;
grant all on public.gmail_sync_jobs to service_role;

create or replace function public.claim_sync_batch(p_workspace uuid,p_user uuid,p_kind text,p_request jsonb,p_run bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j gmail_sync_jobs; r jsonb; token uuid := gen_random_uuid();
begin
 perform 1 from workspaces where id=p_workspace and owner_user_id=p_user and status='active' for update;
 if not found then raise exception 'Workspace no disponible'; end if;
 if p_kind not in ('movements','invoices') then raise exception 'Tipo inválido'; end if;
 if p_run is not null then
  select * into j from gmail_sync_jobs where run_id=p_run and workspace_id=p_workspace and user_id=p_user and kind=p_kind;
  if not found then raise exception 'Ejecución no disponible en tu workspace'; end if;
 else
  select * into j from gmail_sync_jobs where workspace_id=p_workspace and not completed order by updated_at desc limit 1;
  if found and (j.kind<>p_kind or j.request<>p_request) then
   return jsonb_build_object('busy',true,'id',j.run_id,'recoverable',true);
  end if;
 end if;
 if j.run_id is not null and j.completed then return jsonb_build_object('id',j.run_id,'completed',true,'state',j.state); end if;
 if j.run_id is not null and j.lease_until>now() then return jsonb_build_object('busy',true,'id',j.run_id); end if;
 if j.run_id is null then
  r := begin_workspace_sync(p_workspace,p_user,p_request || jsonb_build_object('phase','5G','kind',p_kind));
  if (r->>'busy')::boolean then return r; end if;
  insert into gmail_sync_jobs(run_id,workspace_id,user_id,kind,request) values((r->>'id')::bigint,p_workspace,p_user,p_kind,p_request) returning * into j;
 end if;
 update gmail_sync_jobs set lease=token,lease_until=now()+interval '3 minutes',updated_at=now() where run_id=j.run_id;
 update gmail_sync_runs set status='running',finished_at=null where id=j.run_id;
 return jsonb_build_object('id',j.run_id,'lease',token,'state',j.state,'request',j.request);
end $$;

create or replace function public.save_sync_batch(p_run bigint,p_lease uuid,p_state jsonb,p_release boolean default false,p_complete boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare j gmail_sync_jobs; s jsonb := coalesce(p_state->'stats','{}');
begin
 select * into j from gmail_sync_jobs where run_id=p_run for update;
 if not found or j.lease is distinct from p_lease or j.lease_until<now() then raise exception 'El lote perdió su reserva; vuelve a intentar'; end if;
 update gmail_sync_jobs set state=p_state,updated_at=now(),completed=p_complete,
 lease=case when p_release then null else p_lease end,
 lease_until=case when p_release then null else now()+interval '3 minutes' end where run_id=p_run;
 update gmail_sync_runs set
 status=case when p_complete then case when coalesce((s->>'errors')::int,0)>0 then 'partial' else 'success' end else 'running' end,
 finished_at=case when p_complete then now() else null end,
 messages_scanned=coalesce((s->>'messagesScanned')::int,0),
 movements_created=coalesce((s->>'movementsCreated')::int,0),invoices_created=coalesce((s->>'invoicesCreated')::int,0),
 duplicates_ignored=coalesce((s->>'movementDuplicates')::int,(s->>'duplicates')::int,0),errors_count=coalesce((s->>'errors')::int,0),
 detail=coalesce(detail,'{}') || coalesce(p_state->'detail','{}') || jsonb_build_object('phase','5G','processed',p_state->'offset','messages_found',jsonb_array_length(coalesce(p_state->'refs','[]')),'has_more',not p_complete,'bank_progress',p_state->'bankProgress','last_error',p_state->'last_error')
 where id=p_run;
end $$;
revoke all on function public.claim_sync_batch(uuid,uuid,text,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.save_sync_batch(bigint,uuid,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.claim_sync_batch(uuid,uuid,text,jsonb,bigint) to service_role;
grant execute on function public.save_sync_batch(bigint,uuid,jsonb,boolean,boolean) to service_role;

create or replace function public.pending_workspace_sync()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',j.run_id,'kind',j.kind,'processed',j.state->'offset','messages_found',jsonb_array_length(coalesce(j.state->'refs','[]')),'bank_progress',j.state->'bankProgress','last_error',j.state->'last_error','busy',coalesce(j.lease_until>now(),false))
 from gmail_sync_jobs j where not j.completed and workspace_access_allowed(j.workspace_id)
 order by j.updated_at desc limit 1
$$;
revoke all on function public.pending_workspace_sync() from public,anon;
grant execute on function public.pending_workspace_sync() to authenticated;
create or replace function public.cancel_workspace_sync(p_run bigint)
returns void language plpgsql security definer set search_path=public as $$
declare ws uuid; j gmail_sync_jobs;
begin
 select workspace_id into ws from gmail_sync_jobs where run_id=p_run;
 if ws is null or not workspace_access_allowed(ws) then raise exception 'Ejecución no disponible'; end if;
 perform 1 from workspaces where id=ws and owner_user_id=auth.uid() for update;
 if not found then raise exception 'Solo el propietario puede cancelar'; end if;
 select * into j from gmail_sync_jobs where run_id=p_run for update;
 if j.lease_until>now() then raise exception 'Espera a que termine el lote activo antes de cancelar'; end if;
 update gmail_sync_jobs set completed=true,lease=null,lease_until=null,updated_at=now() where run_id=p_run;
 update gmail_sync_runs set status='error',finished_at=now(),detail=coalesce(detail,'{}') || '{"cancelled_by_owner":true,"has_more":false}'::jsonb where id=p_run;
end $$;
revoke all on function public.cancel_workspace_sync(bigint) from public,anon;
grant execute on function public.cancel_workspace_sync(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
