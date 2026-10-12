import {describe,it,expect,vi,beforeAll,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('../supabase/functions/_shared/supabase.ts',()=>({requireAppAdmin:async()=>({client:mocks,user:{id:'user'},workspaceId:'own',email:'a@test'}),adminClient:()=>mocks}));
vi.mock('../supabase/functions/_shared/workspaceBanks.ts',()=>({workspaceBanks:async()=>['nequi']}));
vi.mock('../supabase/functions/_shared/crypto.ts',()=>({decryptSecret:async()=>'refresh'}));
vi.mock('../supabase/functions/_shared/google.ts',()=>({refreshGoogleAccessToken:async()=>({access_token:'test'})}));
let handler;
beforeAll(async()=>{vi.stubGlobal('Deno',{serve:fn=>{handler=fn;},env:{get:()=>''}});await import('../supabase/functions/gmail-sync-now/index.ts');});
let state,completed,lists;
beforeEach(()=>{
 state={};completed=false;lists=0;
 mocks.rpc.mockReset().mockImplementation(async(name,args)=>{
  if(name==='claim_sync_batch')return {data:{id:10,lease:'lease',state:structuredClone(state),request:{mode:'range',banks:['nequi'],date_from:'2026-10-01',date_to:'2026-10-12'}}};
  state=structuredClone(args.p_state);completed=args.p_complete;return {error:null};
 });
 mocks.from.mockReset().mockImplementation(table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{google_email:'a@test',status:'connected',refresh_token_ciphertext:'x',refresh_token_iv:'y'}}),update:()=>q,insert:async()=>({error:null}),then:resolve=>resolve({error:null})};return q;});
 vi.stubGlobal('fetch',vi.fn(async url=>{
  if(String(url).includes('maxResults')){lists++;return new Response(JSON.stringify({messages:Array.from({length:7},(_,i)=>({id:String(i)}))}));}
  return new Response(JSON.stringify({id:'x',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'not-a-bank@test'}]}}));
 }));
});
const request=body=>new Request('https://test/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
describe('Recorrido Edge por lotes',()=>{
 it('guarda cada correo y retoma los restantes sin repetir la consulta Gmail',async()=>{
  const first=await (await handler(request({mode:'range',date_from:'2026-10-01',date_to:'2026-10-12'}))).json();
  expect(first).toMatchObject({has_more:true,processed:5,sync_run_id:10});expect(state.offset).toBe(5);expect(completed).toBe(false);
  const last=await (await handler(request({resume_run_id:10}))).json();
  expect(last.messages_scanned).toBe(7);expect(state.offset).toBe(7);expect(completed).toBe(true);expect(lists).toBe(1);
  expect(state.parameters.date_from).toBe('2026-10-01');
 });
 it('una caída de Gmail conserva el trabajo pendiente',async()=>{
  vi.mocked(fetch).mockRejectedValue(new Error('red perdida'));
  const result=await (await handler(request({mode:'quick'}))).json();
  expect(result).toMatchObject({recoverable:true,sync_run_id:10});expect(state.last_error).toBe('red perdida');expect(completed).toBe(false);
 },10000);
 it('guarda la paginación Gmail antes de empezar a extraer',async()=>{
  let searches=0;
  vi.mocked(fetch).mockImplementation(async url=>{
   if(String(url).includes('maxResults')) {searches++;if(searches===2)expect(String(url)).toContain('pageToken=next');return new Response(JSON.stringify({messages:[{id:String(searches)}],...(searches===1?{nextPageToken:'next'}:{})}));}
   return new Response(JSON.stringify({id:'x',payload:{headers:[]}}));
  });
  const first=await (await handler(request({mode:'range'}))).json();expect(first.has_more).toBe(true);expect(state.listing_page_token).toBe('next');expect(state.listing_done).toBeUndefined();
  const last=await (await handler(request({resume_run_id:10}))).json();expect(last.messages_scanned).toBe(2);expect(completed).toBe(true);expect(state.listing_done).toBe(true);
 });
});
