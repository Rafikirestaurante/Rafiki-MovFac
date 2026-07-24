import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedVersion = "1.3.4";
const expectedPhase = "Fase 3A.3";

const migrations = [
  "supabase/2026-07-14-fase1a-base-independiente.sql",
  "supabase/2026-07-16-fase2a-motor-sincronizacion.sql",
  "supabase/2026-07-16-fase2b-bancolombia.sql",
  "supabase/2026-07-16-fase2b1-fecha-hora-sincronizacion-movimientos.sql",
  "supabase/2026-07-17-fase2b2-acceso-publico-empleados.sql",
  "supabase/2026-07-17-fase2b32-simplificacion-operativa.sql",
  "supabase/2026-07-17-fase2d-facturacion-electronica.sql"
];

const edgeFunctions = [
  "gmail-oauth-start",
  "gmail-oauth-callback",
  "gmail-connection-status",
  "gmail-test-connection",
  "gmail-diagnostics",
  "gmail-disconnect",
  "gmail-sync-now",
  "gmail-sync-invoices",
  "employee-access-admin",
  "employee-public-access"
];

const required = [
  "README.md",
  "package.json",
  "vercel.json",
  "vite.config.js",
  ".gitignore",
  ".env.example",
  ".github/workflows/deploy-supabase-functions.yml",
  "src/App.jsx",
  "src/main.jsx",
  "src/config/appMetadata.js",
  "src/pages/SettingsPage.jsx",
  "src/pages/EmployeePublicPage.jsx",
  "src/pages/InvoicesPage.jsx",
  "src/pages/MovementsPage.jsx",
  "src/services/gmailIntegrationService.js",
  "src/services/employeeAccessService.js",
  "src/services/invoiceService.js",
  "src/services/movementService.js",
  "src/services/dashboardService.js",
  "src/utils/calendar.js",
  "public/manifest.webmanifest",
  "public/empleados.webmanifest",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/empleados-icon-192.png",
  "public/empleados-icon-512.png",
  "supabase/config.toml",
  "supabase/functions/.env.example",
  "supabase/functions/_shared/bancolombia.ts",
  "supabase/functions/_shared/electronicInvoice.ts",
  "supabase/functions/_shared/employeeAccess.ts",
  "supabase/functions/_shared/cors.ts",
  "docs/INSTALACION-GMAIL-SUPABASE.md",
  "docs/FASE-2B-BANCOLOMBIA.md",
  "docs/FASE-2B2-ACCESO-PUBLICO-EMPLEADOS.md",
  "docs/FASE-2B34-BUSQUEDA-RAPIDA-20-ALERTAS.md",
  "docs/FASE-2D-FACTURACION-ELECTRONICA.md",
  "docs/FASE-3A-ESTABILIZACION-BASE.md",
  "docs/CRONOGRAMA-PROYECTO.md",
  "RESUMEN-FASE3A.md",
  "docs/FASE-3A1-AJUSTES-OPERATIVOS-CALENDARIO.md",
  "RESUMEN-FASE3A1.md",
  "docs/FASE-3A2-NUEVA-REGLA-BANCOLOMBIA.md",
  "RESUMEN-FASE3A2.md",
  "docs/FASE-3A3-BUSQUEDAS-1-3-6-HORAS.md",
  "RESUMEN-FASE3A3.md",
  "tests/calendar.test.js",
  "tests/bancolombia.test.ts",
  "tests/electronicInvoice.test.ts",
  ...migrations,
  ...edgeFunctions.map((name) => `supabase/functions/${name}/index.ts`)
];

function fail(message) {
  throw new Error(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireText(content, token, context) {
  if (!content.includes(token)) fail(`${context} no contiene: ${token}`);
}

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) fail(`Archivos faltantes:\n${missing.join("\n")}`);

const forbiddenFiles = ["package-lock.json", "npm-shrinkwrap.json", ".env", ".env.local", ".env.production"];
const presentForbidden = forbiddenFiles.filter((file) => fs.existsSync(path.join(root, file)));
if (presentForbidden.length) fail(`Archivos prohibidos encontrados:\n${presentForbidden.join("\n")}`);

const packageJson = JSON.parse(read("package.json"));
if (packageJson.name !== "rafiki-movimientos-facturas") fail("Nombre de proyecto inesperado.");
if (packageJson.version !== expectedVersion) fail(`Versión esperada en package.json: ${expectedVersion}.`);
if (packageJson.scripts?.check !== "npm test && npm run lint && npm run validate && npm run build") {
  fail("El comando npm run check no contiene la secuencia integral esperada.");
}

const metadata = read("src/config/appMetadata.js");
requireText(metadata, `APP_VERSION = "${expectedVersion}"`, "appMetadata.js");
requireText(metadata, `APP_PHASE = "${expectedPhase}"`, "appMetadata.js");

const settings = read("src/pages/SettingsPage.jsx");
requireText(settings, "APP_VERSION", "SettingsPage.jsx");
requireText(settings, "APP_PHASE_TITLE", "SettingsPage.jsx");

const readme = read("README.md");
requireText(readme, `**${expectedVersion} — ${expectedPhase}: búsquedas Bancolombia de 1, 3 y 6 horas**`, "README.md");
requireText(readme, "npm install --package-lock=false", "README.md");
requireText(readme, "Las Fases 3A.1, 3A.2 y 3A.3 no requieren migraciones SQL nuevas", "README.md");
for (const migration of migrations) requireText(readme, migration, "README.md");
for (const functionName of edgeFunctions) requireText(readme, `\`${functionName}\``, "README.md");

const gitignore = read(".gitignore").split(/\r?\n/).map((line) => line.trim());
for (const entry of ["node_modules/", "dist/", ".env", ".env.local", "package-lock.json", "npm-shrinkwrap.json"]) {
  if (!gitignore.includes(entry)) fail(`.gitignore no contiene ${entry}`);
}

const frontendEnv = read(".env.example");
requireText(frontendEnv, "VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co", ".env.example");
requireText(frontendEnv, "VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY", ".env.example");

const functionEnv = read("supabase/functions/.env.example");
for (const variable of [
  "GOOGLE_GMAIL_CLIENT_ID=",
  "GOOGLE_GMAIL_CLIENT_SECRET=",
  "GOOGLE_GMAIL_REDIRECT_URI=",
  "APP_PUBLIC_URL=",
  "APP_ALLOWED_ORIGINS=",
  "GMAIL_TOKEN_ENCRYPTION_KEY="
]) requireText(functionEnv, variable, "supabase/functions/.env.example");
if (/^APP_PUBLIC_URL=.*(?:Valor:|["'])/m.test(functionEnv)) fail("APP_PUBLIC_URL contiene un formato de ejemplo inválido.");

const vercel = JSON.parse(read("vercel.json"));
if (!String(vercel.installCommand || "").includes("--package-lock=false")) fail("Vercel debe instalar con --package-lock=false.");
if (/\bnpm\s+ci\b/i.test(String(vercel.installCommand || ""))) fail("Vercel no puede usar npm ci.");
if (vercel.outputDirectory !== "dist") fail("Vercel debe publicar el directorio dist.");

const workflow = read(".github/workflows/deploy-supabase-functions.yml");
for (const functionName of edgeFunctions) {
  requireText(workflow, `supabase functions deploy ${functionName}`, "Workflow de Edge Functions");
}

const discoveredFunctions = fs.readdirSync(path.join(root, "supabase/functions"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared" && fs.existsSync(path.join(root, "supabase/functions", entry.name, "index.ts")))
  .map((entry) => entry.name)
  .sort();
const expectedFunctionsSorted = [...edgeFunctions].sort();
if (JSON.stringify(discoveredFunctions) !== JSON.stringify(expectedFunctionsSorted)) {
  fail(`Las Edge Functions encontradas no coinciden con las esperadas.\nEncontradas: ${discoveredFunctions.join(", ")}`);
}

const baseSql = read(migrations[0]);
for (const token of [
  "create table if not exists public.app_users",
  "public.financial_movements",
  "public.electronic_invoices",
  "public.daily_verifications",
  "public.gmail_connections",
  "create or replace function public.handle_new_app_user()"
]) requireText(baseSql, token, migrations[0]);

const invoiceSql = read(migrations.at(-1));
for (const token of ["document_key", "source_file_type", "electronic_invoices_document_key_unique"]) {
  requireText(invoiceSql, token, migrations.at(-1));
}

const supabaseConfig = read("supabase/config.toml");
requireText(supabaseConfig, "[functions.gmail-oauth-callback]", "supabase/config.toml");
requireText(supabaseConfig, "verify_jwt = false", "supabase/config.toml");

const employeePage = read("src/pages/EmployeePublicPage.jsx");
if (employeePage.includes("una vez por minuto")) fail("EmployeePublicPage todavía menciona el límite de un minuto.");
for (const token of ["synchronize(1)", "synchronize(3)", "synchronize(6)", "Búsqueda rápida", "3 horas", "6 horas"]) requireText(employeePage, token, "EmployeePublicPage.jsx");
const movementsPage = read("src/pages/MovementsPage.jsx");
for (const token of ["synchronizeQuick(1)", "synchronizeQuick(3)", "synchronizeQuick(6)", "Búsqueda rápida", "3 horas", "6 horas"]) requireText(movementsPage, token, "MovementsPage.jsx");
const gmailService = read("src/services/gmailIntegrationService.js");
requireText(gmailService, 'quick_hours: hours', "gmailIntegrationService.js");
const employeeService = read("src/services/employeeAccessService.js");
requireText(employeeService, 'quick_hours: hours', "employeeAccessService.js");
const syncNow = read("supabase/functions/gmail-sync-now/index.ts");
if (syncNow.includes("sync_rate_limited") || syncNow.includes("wait_seconds: 60")) fail("gmail-sync-now todavía contiene el rate limit público de un minuto.");
for (const token of ["requires_review: true", "unsupported_notification", "unrecognized_reason", "[1, 3, 6].includes(requestedQuickHours)", "quickHours === 6 ? 120 : quickHours === 3 ? 60 : 20", "after:${Math.floor(quickStart.getTime() / 1000)}"]) requireText(syncNow, token, "gmail-sync-now");

const employeePublicAccess = read("supabase/functions/employee-public-access/index.ts");
for (const token of ["quick_window_hours: [1, 3, 6]", "quick_message_limits: { 1: 20, 3: 60, 6: 120 }"]) requireText(employeePublicAccess, token, "employee-public-access");

const bancolombiaExtractor = read("supabase/functions/_shared/bancolombia.ts");
for (const token of [
  'BANCOLOMBIA_EXTRACTOR_VERSION = "bancolombia-3A2-v3"',
  "payment_kind: paymentKind || null",
  "payment_origin: paymentOrigin || null",
  "account_type: accountType || null",
  "explicitTime || text.match"
]) requireText(bancolombiaExtractor, token, "bancolombia.ts");
const bancolombiaTests = read("tests/bancolombia.test.ts");
for (const token of ["PROVEEDOR de REDEBAN SA", 'payment_kind: "PROVEEDOR"', 'detail: "REDEBAN SA"']) requireText(bancolombiaTests, token, "bancolombia.test.ts");

const dashboard = read("src/pages/DashboardPage.jsx");
for (const token of ["Calendario de actividad", "Alertas Bancolombia no reconocidas", "getDashboardMonthData"]) requireText(dashboard, token, "DashboardPage.jsx");

const mainManifest = JSON.parse(read("public/manifest.webmanifest"));
const employeeManifest = JSON.parse(read("public/empleados.webmanifest"));
if (mainManifest.id !== "/" || mainManifest.start_url !== "/") fail("El manifiesto principal tiene una ruta inesperada.");
if (employeeManifest.id !== "/empleados" || employeeManifest.start_url !== "/empleados") fail("El manifiesto de empleados tiene una ruta inesperada.");

console.log(`Validación correcta: Rafiki MF ${expectedVersion} / ${expectedPhase}.`);
console.log(`Estructura: ${migrations.length} migraciones, ${edgeFunctions.length} Edge Functions y documentación vigente.`);
