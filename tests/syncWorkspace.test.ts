import {describe,it,expect,vi,beforeAll,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock("../supabase/functions/_shared/supabase.ts",()=>({requireAppAdmin:async request=>({client:mocks,user:{id:request.headers.get('authorization')},workspaceId:request.headers.get('authorization'),email:'test@example.test'}),adminClient:()=>mocks}));
vi.mock("../supabase/functions/_shared/workspaceBanks.ts",()=>({workspaceBanks:async()=>['nequi']}));
vi.mock("npm:fflate@0.8.2",()=>({unzipSync:vi.fn()}));
let movementHandler,invoiceHandler;
beforeAll(async()=>{let handler;vi.stubGlobal('Deno',{serve:fn=>{handler=fn;},env:{get:()=>''}});await import('../supabase/functions/gmail-sync-now/index.ts');movementHandler=handler;await import('../supabase/functions/gmail-sync-invoices/index.ts');invoiceHandler=handler;});
beforeEach(()=>{mocks.rpc.mockReset().mockResolvedValue({data:{busy:true,id:99},error:null});mocks.from.mockReset();});
describe('Inicio atómico por workspace',()=>{
 for(const name of ['movements','invoices'])it(`${name} usa la cuenta autenticada y devuelve ejecución activa sin consultar otra cuenta`,async()=>{
  const handler=name==='movements'?movementHandler:invoiceHandler;
  const response=await handler(new Request('https://test/sync',{method:'POST',headers:{authorization:'workspace-B','content-type':'application/json'},body:JSON.stringify({workspace_id:'workspace-A',mode:'quick',banks:['bancolombia']})}));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({active_run_id:99});
  expect(mocks.rpc).toHaveBeenCalledWith('claim_sync_batch',expect.objectContaining({p_workspace:'workspace-B',p_user:'workspace-B'}));
  expect(mocks.from).not.toHaveBeenCalled();
 });
});
