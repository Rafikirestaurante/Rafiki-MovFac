import {describe,it,expect,vi,beforeAll,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),context:vi.fn(),movement:vi.fn(),invoice:vi.fn(),wake:vi.fn(),gmail:vi.fn(),recover:vi.fn()}));
vi.mock('../supabase/functions/_shared/recoverPushBlocker.ts',()=>({recoverPushBlocker:mock.recover}));
vi.mock('../supabase/functions/_shared/supabase.ts',()=>({adminClient:()=>({rpc:mock.rpc})}));
vi.mock('../supabase/functions/_shared/push.ts',()=>({pushOwnerContext:mock.context,pushToken:async()=>({email:'a@example.test',token:'token'}),watchGmail:async()=>({expiration:new Date(Date.now()+7*86400000).toISOString()}),wakePushWorker:mock.wake}));
vi.mock('../supabase/functions/_shared/workspaceBanks.ts',()=>({workspaceBanks:async()=>['nequi']}));
vi.mock('../supabase/functions/_shared/handleMovementSync.ts',()=>({handleMovementSync:mock.movement}));
vi.mock('../supabase/functions/_shared/handleInvoiceSync.ts',()=>({handleInvoiceSync:mock.invoice}));
vi.mock('../supabase/functions/_shared/syncBatch.ts',()=>({gmailFetch:mock.gmail,SyncBatch:class {
 constructor(public client:any,public id:number,public lease:string,public state:any){}
 async save(){const {error}=await this.client.rpc('save_sync_batch',{p_run:this.id,p_state:this.state});if(error)throw error;}
}}));
let handler, state, batches;
beforeAll(async()=>{
 vi.stubGlobal('Deno',{serve:fn=>{handler=fn;},env:{get:key=>key==='GMAIL_PUSH_WORKER_SECRET'?'worker-secret':''}});
 vi.stubGlobal('EdgeRuntime',{waitUntil:()=>{}});
 await import('../supabase/functions/gmail-push-worker/index.ts');
});
beforeEach(()=>{
 mock.recover.mockReset().mockResolvedValue({recovered_run_id:77,kind:'movements',has_more:true});
 state={workspace_id:'workspace-A',owner_user_id:'owner-A',google_email:'a@example.test',lease:'lease',enabled:true,movements:true,invoices:true,cursor_id:'10',watch_expiration:new Date(Date.now()+7*86400000).toISOString(),page_state:{}};batches={};
 mock.rpc.mockReset().mockImplementation(async(name,args)=>{
  if(name==='claim_gmail_push')return {data:structuredClone(state)};
  if(name==='save_gmail_push'){Object.assign(state,structuredClone(args.p_patch));return {error:null};}
  if(name==='claim_sync_batch'){const id=Object.keys(batches).length+100;batches[id]={};return {data:{id,lease:'batch-lease',state:{}}};}
  if(name==='save_sync_batch'){batches[args.p_run]=args.p_state;return {error:null};}
  throw new Error(name);
 });
 mock.context.mockReset().mockResolvedValue({workspaceId:'workspace-A',user:{id:'owner-A'},client:{rpc:mock.rpc}});
 mock.gmail.mockReset().mockResolvedValue(Response.json({historyId:'20',history:[{messagesAdded:[{message:{id:'message-1'}}]}]}));
 mock.movement.mockReset().mockResolvedValue(Response.json({status:'success',has_more:false}));
 mock.invoice.mockReset().mockResolvedValue(Response.json({status:'success',has_more:false}));mock.wake.mockReset().mockResolvedValue(undefined);
});
const request=(secret='worker-secret')=>new Request('https://test/worker',{method:'POST',headers:{'x-rafiki-worker-secret':secret},body:'{}'});
describe('Continuación persistente push',()=>{
 it('rechaza una clave incorrecta sin reservar trabajo',async()=>{expect((await handler(request('wrong'))).status).toBe(401);expect(mock.rpc).not.toHaveBeenCalled();});
 it('guarda primero el historial y solo avanza el cursor después de ambos módulos',async()=>{
  await handler(request());expect(state.page_state.refs).toEqual([{id:'message-1'}]);expect(state.cursor_id).toBe('10');expect(mock.rpc.mock.calls.filter(([name])=>name==='claim_sync_batch')).toHaveLength(0);
  await handler(request());expect(state.page_state.movement_run).toBe(100);expect(batches[100].refs).toEqual([{id:'message-1'}]);expect(mock.movement).not.toHaveBeenCalled();
  await handler(request());expect(state.page_state.movement_done).toBe(true);expect(state.cursor_id).toBe('10');
  await handler(request());await handler(request());expect(state.page_state.invoice_done).toBe(true);
  await handler(request());expect(state.cursor_id).toBe('20');expect(state.page_state).toEqual({});expect(state.pending).toBe(false);expect(mock.gmail).toHaveBeenCalledTimes(1);
  expect(mock.context).toHaveBeenCalledWith('workspace-A','owner-A');expect(mock.movement.mock.calls[0][1].workspaceId).toBe('workspace-A');
 });
 it('un lote manual ocupado conserva la página y el cursor',async()=>{
  await handler(request());mock.rpc.mockImplementation(async(name,args)=>{
   if(name==='claim_gmail_push')return {data:structuredClone(state)};
   if(name==='claim_sync_batch')return {data:{busy:true,id:77}};
   if(name==='save_gmail_push'){Object.assign(state,args.p_patch);return {error:null};}
  });
  const result=await handler(request());expect(await result.json()).toMatchObject({recovering:true,recovered_run_id:77});expect(state.cursor_id).toBe('10');expect(state.page_state.refs).toHaveLength(1);expect(state.page_state.movement_run).toBeUndefined();expect(mock.recover).toHaveBeenCalledWith(expect.objectContaining({workspaceId:'workspace-A'}),77,{movements:true,invoices:true},expect.anything());
 });
 it('el historial caducado y un propietario revocado no adelantan el cursor',async()=>{
  mock.gmail.mockResolvedValue(new Response(null,{status:404}));await handler(request());expect(state.last_error).toContain('historial');expect(state.cursor_id).toBe('10');
  mock.context.mockRejectedValue(new Error('Autorización inactiva'));await handler(request());expect(state.last_error).toContain('inactiva');expect(mock.movement).not.toHaveBeenCalled();
 });
 it('no declara procesada una página cuyo lote terminó parcialmente',async()=>{
  await handler(request());await handler(request());mock.movement.mockResolvedValue(Response.json({status:'partial',has_more:false}));
  await handler(request());expect(state.cursor_id).toBe('10');expect(state.page_state.movement_done).not.toBe(true);expect(state.last_error).toContain('errores');
 });
 it('no publica un ID de lote si falló el guardado inicial de sus referencias',async()=>{
  await handler(request());const original=mock.rpc.getMockImplementation();
  mock.rpc.mockImplementation(async(name,args)=>name==='save_sync_batch'?{error:new Error('falló el guardado')}:original(name,args));
  await handler(request());expect(state.page_state.movement_run).toBeUndefined();expect(state.page_state.refs).toHaveLength(1);expect(state.cursor_id).toBe('10');expect(mock.movement).not.toHaveBeenCalled();
 });
});
