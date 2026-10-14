import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const validator=path.resolve('scripts/validate-project.mjs');
function validateFixture(missing=false) {
 const prefix=path.join(os.tmpdir(),'rafiki-functions-');const root=fs.mkdtempSync(prefix);
 if(!root.startsWith(prefix))throw new Error('Ruta temporal inesperada');
 try {
  for(const item of ['src','supabase','package.json','vercel.json'])fs.cpSync(item,path.join(root,item),{recursive:true});
  const legacy=path.join(root,'supabase/functions/employee-public-retired');fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy,'index.ts'),'import x from "./archivo-antiguo-inexistente.ts";');
  fs.mkdirSync(path.join(root,'supabase/functions/.temp'));
  if(missing)fs.unlinkSync(path.join(root,'supabase/functions/gmail-sync-now/index.ts'));
  return spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8',env:{...process.env,VERCEL:'1'}});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
describe('Validación con carpetas históricas en GitHub',()=>{
 it('identifica carpetas adicionales y valida las funciones actuales',()=>{const result=validateFixture();expect(result.status).toBe(0);expect(result.stderr).toContain('employee-public-retired');expect(result.stderr).toContain('.temp');expect(result.stdout).toContain('11 Edge Functions');});
 it('sigue fallando si falta una función requerida',()=>{const result=validateFixture(true);expect(result.status).not.toBe(0);expect(result.stderr).toContain('gmail-sync-now/index.ts');});
});
