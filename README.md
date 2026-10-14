# Rafiki MF — 1.12.0 · Fase 6

Preparación para producción sobre 1.10.0. No incorpora 5H ni 5J.

Lee primero [la guía de Fase 6](docs/FASE-6-1.12.0.md).

## Instalación

1. Confirmar respaldo y configuración APP_PUBLIC_URL/APP_ALLOWED_ORIGINS.
2. Ejecutar supabase/2026-10-12-fase6-readiness.sql en el Supabase de Rafiki MF.
3. Subir código y package-lock.json, desplegar todas las Edge Functions y web con Node 24.
4. Configuración → Preparación para producción → Comprobar instalación.
5. Completar pruebas reales de Gmail, dos cuentas y restauración antes de declarar el cierre de Fase 6.

No se ha cambiado producción ni la configuración de Google desde este trabajo.

## Desarrollo

npm ci
npm run check

Las comprobaciones incluyen PostgreSQL local, pruebas de aplicación, lint, revisión de versiones y compilación. El ZIP excluye dependencias, archivos privados y dist.

Los documentos anteriores se conservan como referencia histórica; no ejecutar todas sus migraciones indiscriminadamente.
