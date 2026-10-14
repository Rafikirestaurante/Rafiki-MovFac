import {adminClient} from '../_shared/supabase.ts';
import {requiredEnv} from '../_shared/env.ts';
import {pushOwnerContext,pushToken,watchGmail,wakePushWorker} from '../_shared/push.ts';
import {historyMessageIds} from '../_shared/pushHistory.ts';
import {workspaceBanks} from '../_shared/workspaceBanks.ts';
import {SyncBatch,gmailFetch} from '../_shared/syncBatch.ts';
import {handleMovementSync} from '../_shared/handleMovementSync.ts';
import {handleInvoiceSync} from '../_shared/handleInvoiceSync.ts';

type PageState={refs?:Array<{id:string}>;target?:string;next?:string;page_token?:string;started_at?:string;movement_run?:number;invoice_run?:number;movement_done?:boolean;invoice_done?:boolean};
async function safeEqual(a:string,b:string) {
 const digest=(v:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
 const [left,right]=await Promise.all([digest(a),digest(b)]);
 return new Uint8Array(left).every((v,i)=>v===new Uint8Array(right)[i]);
}
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 if(request.headers.has('origin'))return new Response(null,{status:403});
 if(!await safeEqual(request.headers.get('x-rafiki-worker-secret')||'',requiredEnv('GMAIL_PUSH_WORKER_SECRET')))return new Response(null,{status:401});
 const client=adminClient();
 const body=await request.json().catch(()=>({}));
 const {data:s,error}=await client.rpc('claim_gmail_push',{p_workspace:body.workspace_id||null});
 if(error)return Response.json({error:'No se pudo reservar el trabajo push'},{status:503});
 if(!s)return Response.json({idle:true});
 const started=new Date().toISOString();
 let page:PageState=s.page_state||{};
 const patch:Record<string,unknown>={started_at:page.started_at||started,page_state:page};
 const save=async()=>{
  const {error}=await client.rpc('save_gmail_push',{p_workspace:s.workspace_id,p_lease:s.lease,p_patch:patch});
  if(error)throw error;
  if(patch.pending===true&&!patch.last_error)EdgeRuntime.waitUntil(wakePushWorker(s.workspace_id).catch(()=>{}));
 };
 try {
  const context=await pushOwnerContext(s.workspace_id,s.owner_user_id);
  const connection=await pushToken(context);
  if(connection.email!==s.google_email)throw new Error('La conexión Gmail cambió. Desactiva y vuelve a activar push.');
  if(!s.watch_expiration||new Date(s.watch_expiration).getTime()<Date.now()+48*3600000) {
   const watch=await watchGmail(connection.token);patch.watch_expiration=watch.expiration;
  }
  if(!page.refs) {
   const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
   url.searchParams.set('startHistoryId',s.cursor_id);url.searchParams.set('historyTypes','messageAdded');url.searchParams.set('maxResults','100');
   url.searchParams.set('fields','history(messagesAdded(message(id))),historyId,nextPageToken');
   if(page.next)url.searchParams.set('pageToken',page.next);
   const response=await gmailFetch(url.toString(),connection.token);
   if(response.status===404)throw new Error('Gmail ya no conserva este historial. Revisa y recupera el rango pendiente manualmente; después desactiva y reactiva push.');
   const history=await response.json();
   if(!response.ok)throw new Error(`Gmail history: ${history.error?.message||response.status}`);
   if(typeof history.historyId!=='string'||!/^\d+$/.test(history.historyId))throw new Error('Historial Gmail inválido');
   page={refs:historyMessageIds(history.history).map(id=>({id})),target:history.historyId,next:history.nextPageToken,page_token:page.next||'',started_at:page.started_at||started};
   patch.page_state=page;
   patch.pending=true;
   await save();return Response.json({history_saved:true});
  }
  const kind=s.movements&&!page.movement_done?'movements':s.invoices&&!page.invoice_done?'invoices':null;
  if(kind&&page.refs?.length) {
   const key=kind==='movements'?'movement_run':'invoice_run';
   let run=page[key];
   if(!run) {
    const banks=await workspaceBanks(context);
    const source={source:'gmail-push',history_start:s.cursor_id,history_page:page.page_token||'',google_email:s.google_email};
    const parameters=kind==='movements'?{...source,mode:'range',banks,quick_hours:null,date_from:null,date_to:null}:{...source,mode:'recent',date_from:null,date_to:null};
    const {data:claimed,error}=await client.rpc('claim_sync_batch',{p_workspace:s.workspace_id,p_user:s.owner_user_id,p_kind:kind,p_request:parameters,p_run:null});
    if(error)throw error;
    if(claimed.busy)throw new Error('Hay otro lote activo; push volverá a intentar.');
    run=Number(claimed.id);
    const batch=new SyncBatch(client,run,claimed.lease,claimed.state||{});
    if(!batch.state.listing_done) {
     batch.state={refs:page.refs,offset:0,listing_done:true,parameters:{query:'Gmail push history',date_from:new Date().toISOString().slice(0,10),date_to:new Date().toISOString().slice(0,10),start_at:'1970-01-01T00:00:00Z'}};
    }
    await batch.save(true);
    page[key]=run;
    // Persistir el ID antes de procesar; el siguiente tick continúa el lote.
    patch.pending=true;await save();return Response.json({queued:true,kind,run_id:run});
   }
   const batchRequest=new Request('https://rafiki.internal/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume_run_id:run})});
   const result=await (kind==='movements'?handleMovementSync:handleInvoiceSync)(batchRequest,context);
   const data=await result.json();
   if(!result.ok||data.error||data.recoverable)throw new Error(data.error||'Lote push pendiente de recuperación');
   if(data.has_more){patch.pending=true;await save();return Response.json({pending:true,kind});}
   if(data.status==='partial')throw new Error('El lote push terminó con errores. Consulta Diagnóstico avanzado; los correos quedan pendientes.');
   if(kind==='movements')page.movement_done=true;else page.invoice_done=true;
   patch.pending=true;await save();return Response.json({processed:true,kind});
  }
  if(kind) {
   if(kind==='movements')page.movement_done=true;else page.invoice_done=true;
  }
  if((!s.movements||page.movement_done)&&(!s.invoices||page.invoice_done)) {
   if(page.next) {patch.page_state={next:page.next,started_at:page.started_at};patch.pending=true;}
   else {patch.cursor_id=page.target;patch.page_state={};patch.pending=false;patch.last_completed_at=new Date().toISOString();}
   patch.last_checked_at=new Date().toISOString();
  } else patch.pending=true;
  await save();return Response.json({ok:true});
 } catch(error) {
  patch.last_error=String(error instanceof Error?error.message:error).slice(0,1000);
  patch.pending=true;patch.next_attempt_at=new Date(Date.now()+60000).toISOString();
  try {await save();}catch{return Response.json({error:'No se pudo guardar el estado push'},{status:503});}
  return Response.json({pending:true,error:patch.last_error});
 }
});
