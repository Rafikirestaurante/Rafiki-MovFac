import {allowedOrigins} from './cors.ts';
export const RELEASE_VERSION='1.12.0';
export function releaseConfiguration(request:Request) {
 const get=(key:string)=>String(Deno.env.get(key)||'').trim();
 const checks:Array<{key:string;ok:boolean}>=[];
 for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_GMAIL_CLIENT_ID','GOOGLE_GMAIL_CLIENT_SECRET']) checks.push({key,ok:Boolean(get(key))});
 const https=(value:string)=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
 checks.push({key:'APP_PUBLIC_URL',ok:https(get('APP_PUBLIC_URL'))});
 let redirectOk=false;
 try {const redirect=new URL(get('GOOGLE_GMAIL_REDIRECT_URI'));const base=new URL(get('SUPABASE_URL'));redirectOk=redirect.origin===base.origin && redirect.pathname==='/functions/v1/gmail-oauth-callback' && redirect.protocol==='https:' && !redirect.search && !redirect.hash;}catch{/* Missing or invalid URL. */}
 checks.push({key:'GOOGLE_GMAIL_REDIRECT_URI',ok:redirectOk});
 let keyOk=false;try{keyOk=atob(get('GMAIL_TOKEN_ENCRYPTION_KEY')).length===32;}catch{/* Invalid Base64. */}
 checks.push({key:'GMAIL_TOKEN_ENCRYPTION_KEY',ok:keyOk});
 checks.push({key:'BROWSER_ORIGIN',ok:allowedOrigins().includes(request.headers.get('origin')||'')});
 return {version:RELEASE_VERSION,checked_at:new Date().toISOString(),ok:checks.every(c=>c.ok),checks};
}
