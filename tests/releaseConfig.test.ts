import {describe,it,expect,vi,beforeEach} from 'vitest';
import {optionsResponse,corsHeaders} from '../supabase/functions/_shared/cors.ts';
import {releaseConfiguration} from '../supabase/functions/_shared/release.ts';
let env:Record<string,string>;
beforeEach(()=>{env={APP_PUBLIC_URL:'https://rafiki-mf.vercel.app',APP_ALLOWED_ORIGINS:'http://localhost:5173',SUPABASE_URL:'https://own.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-service',GOOGLE_GMAIL_CLIENT_ID:'client',GOOGLE_GMAIL_CLIENT_SECRET:'private-secret',GOOGLE_GMAIL_REDIRECT_URI:'https://own.supabase.co/functions/v1/gmail-oauth-callback',GMAIL_TOKEN_ENCRYPTION_KEY:btoa('a'.repeat(32))};vi.stubGlobal('Deno',{env:{get:key=>env[key]}});});
const request=(origin:string,method='POST')=>new Request('https://own.supabase.co/test',{method,headers:{Origin:origin}});
describe('Configuración de producción',()=>{
 it('permite únicamente los orígenes configurados',()=>{expect(optionsResponse(request('https://rafiki-mf.vercel.app'))).toBeNull();expect(optionsResponse(request('https://attacker.test'))?.status).toBe(403);expect(optionsResponse(request('https://rafiki-mf.vercel.app','OPTIONS'))?.status).toBe(204);expect(corsHeaders(request('https://attacker.test'))['Access-Control-Allow-Origin']).toBeUndefined();});
 it('sin configuración no permite cualquier web',()=>{env.APP_PUBLIC_URL='';env.APP_ALLOWED_ORIGINS='';expect(optionsResponse(request('https://rafiki-mf.vercel.app'))?.status).toBe(403);});
 it('comprueba formatos y devuelve solo indicadores sin secretos',()=>{const result=releaseConfiguration(request('https://rafiki-mf.vercel.app'));expect(result.ok).toBe(true);expect(JSON.stringify(result)).not.toContain('private-service');expect(JSON.stringify(result)).not.toContain('private-secret');expect(result.version).toBe('1.12.0');});
 it('detecta un callback de otro proyecto y una clave inválida',()=>{env.GOOGLE_GMAIL_REDIRECT_URI='https://other.supabase.co/functions/v1/gmail-oauth-callback';env.GMAIL_TOKEN_ENCRYPTION_KEY='wrong';const result=releaseConfiguration(request('https://rafiki-mf.vercel.app'));expect(result.ok).toBe(false);expect(result.checks.filter(c=>!c.ok).map(c=>c.key)).toEqual(['GOOGLE_GMAIL_REDIRECT_URI','GMAIL_TOKEN_ENCRYPTION_KEY']);});
});
