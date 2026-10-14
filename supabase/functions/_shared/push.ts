import {adminClient, type AdminContext} from './supabase.ts';
import {decryptSecret} from './crypto.ts';
import {refreshGoogleAccessToken} from './google.ts';
import {requiredEnv} from './env.ts';
export const PUSH_TOPIC = () => requiredEnv('GMAIL_PUSH_TOPIC');
export async function pushOwnerContext(workspaceId:string,userId:string):Promise<AdminContext> {
 const client=adminClient();
 const {data:ws,error:wError}=await client.from('workspaces').select('id').eq('id',workspaceId).eq('owner_user_id',userId).eq('status','active').maybeSingle();
 const {data:profile,error:pError}=await client.from('app_users').select('email,role,status').eq('id',userId).maybeSingle();
 if(wError||pError||!ws||!profile||profile.status!=='active'||!['platform_admin','workspace_owner','admin'].includes(profile.role)) throw new Error('Propietario no autorizado');
 const email=String(profile.email).trim().toLowerCase();
 if(profile.role==='platform_admin'&&email!=='rafiki.restaurante@gmail.com')throw new Error('Administrador inválido');
 if(email!=='rafiki.restaurante@gmail.com') {
  const {data,error}=await client.from('authorized_users').select('id').eq('email',email).eq('status','active').maybeSingle();
  if(error||!data)throw new Error('Autorización inactiva');
 }
 return {client,workspaceId,user:{id:userId,email} as AdminContext['user'],email,role:profile.role};
}
export async function pushToken(context:AdminContext) {
 const {data,error}=await context.client.from('gmail_connections').select('google_email,status,refresh_token_ciphertext,refresh_token_iv').eq('workspace_id',context.workspaceId).eq('owner_user_id',context.user.id).maybeSingle();
 if(error||!data||data.status!=='connected'||!data.refresh_token_ciphertext)throw new Error('Conecta Gmail antes de activar los avisos');
 const token=await refreshGoogleAccessToken(await decryptSecret(data.refresh_token_ciphertext,data.refresh_token_iv));
 return {email:String(data.google_email).toLowerCase(),token:token.access_token};
}
export async function watchGmail(token:string) {
 const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({topicName:PUSH_TOPIC()}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok)throw new Error(`Gmail watch: ${data.error?.message||response.status}`);
 if(!/^\d+$/.test(data.historyId)||!Number.isFinite(Number(data.expiration)))throw new Error('Gmail watch respondió sin vigencia');
 return {historyId:String(data.historyId),expiration:new Date(Number(data.expiration)).toISOString()};
}
export async function stopGmail(token:string) {
 const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Gmail stop: ${response.status}`);
}
export async function wakePushWorker(workspaceId?:string) {
 const response=await fetch(`${requiredEnv('SUPABASE_URL')}/functions/v1/gmail-push-worker`,{method:'POST',headers:{'Content-Type':'application/json','x-rafiki-worker-secret':requiredEnv('GMAIL_PUSH_WORKER_SECRET')},body:JSON.stringify({workspace_id:workspaceId}),signal:AbortSignal.timeout(10000)});
 await response.body?.cancel();
}
