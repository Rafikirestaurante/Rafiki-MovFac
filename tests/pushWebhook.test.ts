import {describe,it,expect,vi,beforeAll,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({verify:vi.fn(),rpc:vi.fn(),wake:vi.fn()}));
vi.mock('npm:jose@6.1.0',()=>({createRemoteJWKSet:()=>({}),jwtVerify:mock.verify}));
vi.mock('../supabase/functions/_shared/supabase.ts',()=>({adminClient:()=>({rpc:mock.rpc})}));
vi.mock('../supabase/functions/_shared/push.ts',()=>({wakePushWorker:mock.wake}));
let handler;
const environment={GMAIL_PUSH_AUDIENCE:'https://test/webhook',GMAIL_PUSH_IDENTITY_EMAIL:'push@project.iam.gserviceaccount.com',GMAIL_PUSH_SUBSCRIPTION:'projects/project/subscriptions/push'};
beforeAll(async()=>{
 vi.stubGlobal('Deno',{serve:fn=>{handler=fn;},env:{get:key=>environment[key]}});
 vi.stubGlobal('EdgeRuntime',{waitUntil:()=>{}});
 await import('../supabase/functions/gmail-push-webhook/index.ts');
});
beforeEach(()=>{mock.rpc.mockReset().mockResolvedValue({error:null});mock.wake.mockReset().mockResolvedValue(undefined);mock.verify.mockReset().mockResolvedValue({payload:{email:environment.GMAIL_PUSH_IDENTITY_EMAIL,email_verified:true}});});
const request=(subscription=environment.GMAIL_PUSH_SUBSCRIPTION)=>new Request('https://test/webhook',{method:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({subscription,message:{data:btoa(JSON.stringify({emailAddress:'a@example.test',historyId:'12345678901234567890'}))}})});
describe('Webhook autenticado Pub/Sub',()=>{
 it('rechaza firmas no verificadas sin tocar PostgreSQL',async()=>{mock.verify.mockRejectedValue(new Error('invalid'));expect((await handler(request())).status).toBe(401);expect(mock.rpc).not.toHaveBeenCalled();});
 it('rechaza otra identidad de servicio y otra suscripción',async()=>{
  mock.verify.mockResolvedValue({payload:{email:'attacker@test',email_verified:true}});expect((await handler(request())).status).toBe(401);
  mock.verify.mockResolvedValue({payload:{email:environment.GMAIL_PUSH_IDENTITY_EMAIL,email_verified:true}});expect((await handler(request('projects/other/subscriptions/push'))).status).toBe(403);expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('no confirma el aviso si falló su persistencia',async()=>{mock.rpc.mockResolvedValue({error:{message:'offline'}});expect((await handler(request())).status).toBe(503);expect(mock.wake).not.toHaveBeenCalled();});
 it('confirma después de persistir y conserva historial como texto',async()=>{expect((await handler(request())).status).toBe(204);expect(mock.rpc).toHaveBeenCalledWith('receive_gmail_push',{p_email:'a@example.test',p_history:'12345678901234567890'});expect(mock.verify).toHaveBeenCalledWith('token',expect.anything(),expect.objectContaining({audience:environment.GMAIL_PUSH_AUDIENCE,algorithms:['RS256']}));});
});
