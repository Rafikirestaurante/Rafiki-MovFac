import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {adminClient} from '../_shared/supabase.ts';
import {requiredEnv} from '../_shared/env.ts';
import {decodePushMessage} from '../_shared/pushHistory.ts';
import {wakePushWorker} from '../_shared/push.ts';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 try {
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /i,'');
  const {payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:requiredEnv('GMAIL_PUSH_AUDIENCE'),algorithms:['RS256']});
  if(payload.email!==requiredEnv('GMAIL_PUSH_IDENTITY_EMAIL')||payload.email_verified!==true)return new Response(null,{status:401});
 }catch{return new Response(null,{status:401});}
 try {
  const raw=await request.text();if(raw.length>16000)return new Response(null,{status:413});
  const body=JSON.parse(raw);
  if(body.subscription!==requiredEnv('GMAIL_PUSH_SUBSCRIPTION'))return new Response(null,{status:403});
  const notice=decodePushMessage(body.message?.data);
  const {error}=await adminClient().rpc('receive_gmail_push',{p_email:notice.emailAddress,p_history:notice.historyId});
  if(error)return new Response(null,{status:503});
  // ACK únicamente después de guardar el aviso. El cron retoma el trabajo si el despertar falla.
  EdgeRuntime.waitUntil(wakePushWorker().catch(()=>{}));
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:400});}
});
