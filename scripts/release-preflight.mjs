import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
if(pkg.version!==lock.packages[''].version)throw new Error('El registro de dependencias no corresponde a la entrega');
if(Object.keys(lock.packages).some(p=>p.startsWith('../')))throw new Error('El registro contiene rutas locales externas');
for(const field of ['dependencies','devDependencies'])for(const [name,version] of Object.entries(pkg[field]||{}))if(lock.packages[''][field]?.[name]!==version)throw new Error(`Dependencia sin registrar: ${name}`);
if(!read('supabase/functions/_shared/release.ts').includes(pkg.version))throw new Error('Versión del servidor incorrecta');
if(!read('supabase/2026-10-12-fase6-readiness.sql').includes(pkg.version))throw new Error('Versión de la base incorrecta');
const vercel=JSON.parse(read('vercel.json'));
if(!vercel.installCommand.startsWith('npm ci')||vercel.buildCommand!=='npm run check')throw new Error('Vercel omite las comprobaciones de entrega');
if(!read('.github/workflows/deploy-supabase-functions.yml').includes('needs: validate'))throw new Error('Despliegue sin validación previa');
const key=process.env.VITE_SUPABASE_ANON_KEY||'';
let privileged=key.startsWith('sb_secret_');
try{privileged ||= JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role==='service_role';}catch{/* Publishable keys need not be JWTs. */}
if(privileged)throw new Error('VITE_SUPABASE_ANON_KEY contiene una credencial privada; usa únicamente anon o publishable');
// Estos archivos no deben formar parte de la entrega.
for(const file of ['.env','.env.local','.env.production'])if(fs.existsSync(file))throw new Error(`Retira ${file} antes de distribuir`);
console.log(`Preparación de entrega ${pkg.version}: versiones, dependencias y comprobaciones de despliegue coherentes.`);
