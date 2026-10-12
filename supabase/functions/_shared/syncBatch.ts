import type { adminClient } from './supabase.ts';
type Client = ReturnType<typeof adminClient>;
export type BatchState = {
 refs?: Array<{id:string;threadId?:string}>; offset?:number;
 stats?:Record<string,number>; detail?:Record<string,unknown>;
 bankProgress?:Record<string,{scanned:number;unrecognized:number;errors:number}>;
 last_error?:string|null; parameters?:Record<string,unknown>; truncated?:boolean;
 listing_done?:boolean; listing_page_token?:string;
};
export class SyncBatch {
 constructor(public client:Client,public id:number,public lease:string,public state:BatchState) {}
 async save(release=false,complete=false) {
  const {error}=await this.client.rpc('save_sync_batch',{p_run:this.id,p_lease:this.lease,p_state:this.state,p_release:release,p_complete:complete});
  if(error) throw new Error(`No se pudo guardar el avance: ${error.message}`);
 }
}
export async function gmailFetch(url:string,token:string):Promise<Response> {
 for(let attempt=0;attempt<3;attempt++) {
  try {
   const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
   if (![429,500,502,503,504].includes(response.status) || attempt===2) return response;
   await response.body?.cancel();
  } catch(error) {if(attempt===2) throw error;}
  await new Promise(resolve=>setTimeout(resolve,500*2**attempt));
 }
 throw new Error('Gmail no respondió');
}
