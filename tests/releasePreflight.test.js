import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {Buffer} from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertPublicKey} from '../scripts/public-key-check.mjs';

describe('Credenciales de la compilación pública',()=>{
 it('admite una clave pública',()=>{expect(()=>assertPublicKey('sb_publishable_public')).not.toThrow();});
 it('rechaza una clave secreta sin imprimirla',()=>{let message='';try{assertPublicKey('sb_secret_do-not-print');}catch(error){message=error.message;}expect(message).toContain('credencial privada');expect(message).not.toContain('do-not-print');});
 it('rechaza un JWT service_role',()=>{const key='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';expect(()=>assertPublicKey(key)).toThrow('credencial privada');});
});
function fixtureCheck(vercel,key='sb_publishable_public') {
 const prefix=path.join(os.tmpdir(),'rafiki-build-');
 const root=fs.mkdtempSync(prefix);
 if(!root.startsWith(prefix))throw new Error('Ruta temporal inesperada');
 try {
  for(const file of ['package.json','package-lock.json','vercel.json','scripts/release-preflight.mjs','scripts/public-key-check.mjs','supabase/functions/_shared/release.ts','supabase/2026-10-12-fase6-readiness.sql']) {
   const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);
  }
  return spawnSync(process.execPath,['scripts/release-preflight.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,VERCEL:vercel,VITE_SUPABASE_ANON_KEY:key}});
 }finally {fs.rmSync(root,{recursive:true,force:true});}
}
describe('Checkout de despliegue sin metadatos GitHub',()=>{
 it('Vercel valida la entrega aunque no reciba .github',()=>{const result=fixtureCheck('1');expect(result.stderr).toBe('');expect(result.status).toBe(0);});
 it('la comprobación local sigue exigiendo el workflow',()=>{const result=fixtureCheck('');expect(result.status).not.toBe(0);expect(result.stderr).toContain('Falta el workflow');});
 it('Vercel sigue rechazando una clave privada',()=>{const result=fixtureCheck('1','sb_secret_do-not-print');expect(result.status).not.toBe(0);expect(result.stderr).toContain('credencial privada');expect(result.stderr).not.toContain('do-not-print');});
});
