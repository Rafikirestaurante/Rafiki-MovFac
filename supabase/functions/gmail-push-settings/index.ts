import {requireAppAdmin} from '../_shared/supabase.ts';
import {optionsResponse} from '../_shared/cors.ts';
import {jsonResponse,errorMessage} from '../_shared/http.ts';
import {pushToken,watchGmail,stopGmail,wakePushWorker} from '../_shared/push.ts';

Deno.serve(async request=>{
 const preflight=optionsResponse(request);if(preflight)return preflight;
 if(request.method!=='POST')return jsonResponse(request,{error:'Método no permitido'},405);
 try {
  const context=await requireAppAdmin(request), {client,workspaceId,user}=context;
  const body=await request.json().catch(()=>({}));
  const selection='enabled,movements,invoices,watch_expiration,last_notification_at,last_checked_at,last_completed_at,last_error';
  if(body.action==='enable') {
   if(!['GMAIL_PUSH_TOPIC','GMAIL_PUSH_WORKER_SECRET','GMAIL_PUSH_AUDIENCE','GMAIL_PUSH_IDENTITY_EMAIL','GMAIL_PUSH_SUBSCRIPTION'].every(key=>Deno.env.get(key)))throw new Error('La integración push todavía no está configurada en el servidor');
   if(typeof body.movements!=='boolean'||typeof body.invoices!=='boolean'||(!body.movements&&!body.invoices))throw new Error('Selecciona movimientos, facturas o ambos');
   const connection=await pushToken(context), watch=await watchGmail(connection.token);
   const {error}=await client.rpc('configure_gmail_push',{p_workspace:workspaceId,p_user:user.id,p_email:connection.email,p_movements:body.movements,p_invoices:body.invoices,p_cursor:watch.historyId,p_expiration:watch.expiration});
   if(error)throw error;
   EdgeRuntime.waitUntil(wakePushWorker(workspaceId).catch(()=>{}));
  } else if(body.action==='disable') {
   const {error}=await client.from('gmail_push_state').update({enabled:false,lease:null,lease_until:null,page_state:{}}).eq('workspace_id',workspaceId).eq('owner_user_id',user.id);
   if(error)throw error;
   try {const connection=await pushToken(context);await stopGmail(connection.token);}catch { /* La desactivación local impide procesar avisos aunque Google no responda. */ }
  }
  const {data,error}=await client.from('gmail_push_state').select(selection).eq('workspace_id',workspaceId).eq('owner_user_id',user.id).maybeSingle();
  if(error)throw error;
  return jsonResponse(request,{configured:Boolean(Deno.env.get('GMAIL_PUSH_TOPIC')&&Deno.env.get('GMAIL_PUSH_WORKER_SECRET')&&Deno.env.get('GMAIL_PUSH_AUDIENCE')&&Deno.env.get('GMAIL_PUSH_IDENTITY_EMAIL')&&Deno.env.get('GMAIL_PUSH_SUBSCRIPTION')),state:data});
 } catch(error){return jsonResponse(request,{error:errorMessage(error)},400);}
});
