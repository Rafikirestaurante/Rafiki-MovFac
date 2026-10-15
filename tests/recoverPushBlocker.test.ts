import {describe,it,expect,vi} from 'vitest';
import {recoverPushBlocker} from '../supabase/functions/_shared/recoverPushBlocker.ts';
function fixture(overrides={}) {
 const job={run_id:77,kind:'movements',request:{mode:'range',date_from:'2026-10-14',date_to:'2026-10-15'},lease_until:null,...overrides};
 const query:any={};
 for(const method of ['select','eq'])query[method]=vi.fn(()=>query);
 query.maybeSingle=vi.fn(async()=>({data:job,error:null}));
 const context:any={workspaceId:'workspace-A',user:{id:'owner-A'},client:{from:vi.fn(()=>query)}};
 const handlers={movements:vi.fn(async()=>Response.json({has_more:true})),invoices:vi.fn(async()=>Response.json({has_more:false,status:'success'}))};
 return {context,query,handlers};
}
describe('Recuperación de búsquedas que bloquean Push',()=>{
 it('continúa el lote original del propietario sin sustituir fechas ni referencias',async()=>{
  const f=fixture();
  expect(await recoverPushBlocker(f.context,77,{movements:true,invoices:false},f.handlers)).toMatchObject({recovered_run_id:77,has_more:true});
  expect(f.query.eq.mock.calls).toEqual([['run_id',77],['workspace_id','workspace-A'],['user_id','owner-A'],['completed',false]]);
  expect(await f.handlers.movements.mock.calls[0][0].json()).toEqual({resume_run_id:77});
  expect(f.handlers.movements.mock.calls[0][1]).toBe(f.context);
 });
 it('respeta una reserva activa y no ejecuta un segundo trabajador',async()=>{
  const f=fixture({lease_until:new Date(Date.now()+60000).toISOString()});
  await expect(recoverPushBlocker(f.context,77,{movements:true,invoices:true},f.handlers)).rejects.toThrow('espera su turno');
  expect(f.handlers.movements).not.toHaveBeenCalled();
 });
 it('no inicia Facturas si ese módulo está desactivado y explica cómo liberar Movimientos',async()=>{
  const f=fixture({kind:'invoices'});
  await expect(recoverPushBlocker(f.context,77,{movements:true,invoices:false},f.handlers)).rejects.toThrow('Continuar sincronización');
  expect(f.handlers.invoices).not.toHaveBeenCalled();
 });
 it('recupera Facturas si también tiene Push activado',async()=>{
  const f=fixture({kind:'invoices'});
  expect(await recoverPushBlocker(f.context,77,{movements:true,invoices:true},f.handlers)).toMatchObject({kind:'invoices',has_more:false});
  expect(f.handlers.movements).not.toHaveBeenCalled();
 });
 it('no toma páginas de otro trabajo Push ni declara éxito ante fallos',async()=>{
  const f=fixture({request:{source:'gmail-push'}});
  await expect(recoverPushBlocker(f.context,77,{movements:true,invoices:true},f.handlers)).rejects.toThrow('requiere recuperación');
  expect(f.handlers.movements).not.toHaveBeenCalled();
  const g=fixture();g.handlers.movements.mockResolvedValue(Response.json({error:'Gmail no respondió'},{status:503}));
  await expect(recoverPushBlocker(g.context,77,{movements:true,invoices:true},g.handlers)).rejects.toThrow('Gmail no respondió');
 });
});
