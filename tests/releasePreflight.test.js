import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {Buffer} from 'node:buffer';
const check=key=>spawnSync(process.execPath,['scripts/release-preflight.mjs'],{encoding:'utf8',env:{...process.env,VITE_SUPABASE_ANON_KEY:key}});
describe('Credenciales de la compilación pública',()=>{
 it('admite una clave pública',()=>{expect(check('sb_publishable_public').status).toBe(0);});
 it('rechaza una clave secreta sin imprimirla',()=>{const result=check('sb_secret_do-not-print');expect(result.status).not.toBe(0);expect(result.stderr).toContain('credencial privada');expect(result.stderr).not.toContain('do-not-print');});
 it('rechaza un JWT service_role',()=>{const key='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';expect(check(key).status).not.toBe(0);});
});
