function origin(value:string):string {
 try {const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol) ? url.origin : '';}catch{return '';}
}
export function allowedOrigins():string[] {
 return [...new Set([Deno.env.get('APP_PUBLIC_URL')||'',Deno.env.get('APP_ALLOWED_ORIGINS')||''].flatMap(v=>v.split(',')).map(origin).filter(Boolean))];
}
export function corsHeaders(request?:Request):Record<string,string> {
 const requested=request?.headers.get('origin')||'';
 const allowed=allowedOrigins();
 return {
  ...(allowed.includes(requested)?{'Access-Control-Allow-Origin':requested}:{}),
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Max-Age':'600',Vary:'Origin'
  ,'Access-Control-Expose-Headers':'X-Rafiki-Version'
 };
}
export function optionsResponse(request:Request):Response|null {
 const requested=request.headers.get('origin');
 if(requested && !allowedOrigins().includes(requested))return Response.json({error:'Origen no autorizado. Revisa APP_PUBLIC_URL y APP_ALLOWED_ORIGINS.'},{status:403,headers:{'Cache-Control':'no-store',Vary:'Origin'}});
 if(request.method!=='OPTIONS')return null;
 return new Response(null,{status:204,headers:corsHeaders(request)});
}
