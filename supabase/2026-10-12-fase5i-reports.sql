begin;
create index if not exists financial_movements_workspace_report_idx on public.financial_movements(workspace_id,transaction_date desc,id desc);
create or replace function public.workspace_movement_report(
 p_from date,p_to date,p_bank text default null,p_type text default null,
 p_search text default '',p_min numeric default null,p_max numeric default null,
 p_page integer default 0,p_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Rango de fechas inválido'; end if;
 if p_page<0 or p_size not between 1 and 200 then raise exception 'Página inválida'; end if;
 if p_min<0 or p_max<0 or p_min>p_max then raise exception 'Rango de valores inválido'; end if;
 with filtered as (
 select id,source,movement_type,transaction_date,transaction_at,detail,amount_cop,reference_text
 from financial_movements
 where transaction_date between p_from and p_to
 and (p_bank is null or source=p_bank) and (p_type is null or movement_type=p_type)
 and (coalesce(p_search,'')='' or strpos(lower(coalesce(detail,'')),lower(p_search))>0 or strpos(lower(coalesce(reference_text,'')),lower(p_search))>0)
 and (p_min is null or amount_cop>=p_min) and (p_max is null or amount_cop<=p_max)
 ), totals as (
 select count(*) total,coalesce(sum(amount_cop) filter(where movement_type='income'),0) income,
 coalesce(sum(amount_cop) filter(where movement_type<>'income'),0) expense from filtered
 ), page as (select * from filtered order by transaction_date desc,transaction_at desc nulls last,id desc limit p_size offset p_page*p_size),
 banks as (select source,count(*) count,coalesce(sum(amount_cop) filter(where movement_type='income'),0) income,coalesce(sum(amount_cop) filter(where movement_type<>'income'),0) expense from filtered group by source)
 select jsonb_build_object('total',totals.total,'income',totals.income,'expense',totals.expense,'balance',totals.income-totals.expense,
 'rows',coalesce((select jsonb_agg(page) from page),'[]'),
 'banks',coalesce((select jsonb_agg(banks) from banks),'[]')) into result from totals;
 return result;
end $$;
revoke all on function public.workspace_movement_report(date,date,text,text,text,numeric,numeric,integer,integer) from public,anon;
grant execute on function public.workspace_movement_report(date,date,text,text,text,numeric,numeric,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
