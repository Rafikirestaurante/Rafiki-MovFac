import fs from "node:fs";
import path from "node:path";
import {transform} from "esbuild";
const expectedVersion="1.10.0";
const functions=["gmail-oauth-start","gmail-oauth-callback","gmail-connection-status","gmail-test-connection","gmail-diagnostics","gmail-disconnect","gmail-sync-now","gmail-sync-invoices"];
const read=file=>fs.readFileSync(file,"utf8");
const requireFile=file=>{if(!fs.existsSync(file))throw new Error(`Falta ${file}`);};
for(const file of ["src/App.jsx","src/config/appMetadata.js","src/pages/SettingsPage.jsx","src/pages/MovementsPage.jsx","supabase/2026-10-12-fase5f-isolation.sql","supabase/config.toml",".github/workflows/deploy-supabase-functions.yml"])requireFile(file);
if(JSON.parse(read("package.json")).version!==expectedVersion)throw new Error("Versión incorrecta");
if(!read("src/config/appMetadata.js").includes(expectedVersion)||!read("src/config/appMetadata.js").includes("Fases 5G y 5I"))throw new Error("Metadata incorrecta");
const workflow=read(".github/workflows/deploy-supabase-functions.yml");
for(const name of functions){requireFile(`supabase/functions/${name}/index.ts`);if(!workflow.includes(`supabase functions deploy ${name}`))throw new Error(`Falta despliegue ${name}`);}
const discovered=fs.readdirSync("supabase/functions",{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=="_shared").map(e=>e.name).sort();
if(JSON.stringify(discovered)!==JSON.stringify([...functions].sort()))throw new Error("Funciones inesperadas");
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of [...walk("src"),...walk("supabase/functions")].filter(f=>/\.(js|jsx|ts)$/.test(f))){
 const source=read(file);
 for(const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){requireFile(path.resolve(path.dirname(file),match[1]));}
 await transform(source,{loader:file.endsWith(".ts")?"ts":file.endsWith(".jsx")?"jsx":"js",sourcefile:file});
}
const vercel=JSON.parse(read("vercel.json"));
if(vercel.outputDirectory!=="dist")throw new Error("Salida Vercel incorrecta");
console.log(`Validación estructural y sintaxis aprobada: ${expectedVersion}, ${functions.length} Edge Functions.`);
