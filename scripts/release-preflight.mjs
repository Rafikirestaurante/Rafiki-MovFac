import fs from 'node:fs';
import {assertPublicKey} from './public-key-check.mjs';
assertPublicKey(process.env.VITE_SUPABASE_ANON_KEY||'');
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
if(pkg.version!==lock.packages[''].version)throw new Error('El registro de dependencias no corresponde a la entrega');
if(Object.keys(lock.packages).some(p=>p.startsWith('../')))throw new Error('El registro contiene rutas locales externas');
for(const field of ['dependencies','devDependencies'])for(const [name,version] of Object.entries(pkg[field]||{}))if(lock.packages[''][field]?.[name]!==version)throw new Error(`Dependencia sin registrar: ${name}`);
if(!read('supabase/functions/_shared/release.ts').includes(pkg.version))throw new Error('Versión del servidor incorrecta');
if(!read('supabase/2026-10-12-fase6-readiness.sql').includes(pkg.version))throw new Error('Versión de la base incorrecta');
const vercel=JSON.parse(read('vercel.json'));
if(!vercel.installCommand.startsWith('npm ci')||vercel.buildCommand!=='npm run check')throw new Error('Vercel omite las comprobaciones de entrega');
const workflow='.github/workflows/deploy-supabase-functions.yml';
// Vercel may omit repository metadata from its build checkout. GitHub and local
// validation still require the deployment workflow.
if(fs.existsSync(workflow)) {
 if(!read(workflow).includes('needs: validate'))throw new Error('Despliegue sin validación previa');
}else if(process.env.VERCEL!=='1')throw new Error('Falta el workflow de despliegue');
// Estos archivos no deben formar parte de la entrega.
for(const file of ['.env','.env.local','.env.production'])if(fs.existsSync(file))throw new Error(`Retira ${file} antes de distribuir`);
console.log(`Preparación de entrega ${pkg.version}: versiones, dependencias y comprobaciones de despliegue coherentes.`);
