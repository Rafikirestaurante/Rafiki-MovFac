# Rafiki MF — 1.10.0

Fases 5G (sincronización por lotes y recuperación) y 5I (consultas y reportes de movimientos).
Base: 1.9.0. La fase 5H no se incorpora.

Lee primero [la guía de entrega](docs/FASES-5G-5I-1.10.0.md).

Orden de instalación:
1. Confirmar la migración 5F aplicada al Supabase correcto.
2. Ejecutar supabase/2026-10-12-fase5g-batches.sql.
3. Ejecutar supabase/2026-10-12-fase5i-reports.sql.
4. Desplegar Edge Functions y frontend.
5. Verificar versión 1.10.0 en Configuración y realizar la prueba de aceptación.

No se han aplicado cambios en producción desde esta entrega. La prueba real de aislamiento con una segunda cuenta y su conexión Gmail sigue pendiente.

Desarrollo local: npm install; npm run check.

Incluye pruebas de reglas bancarias, recuperación, reportes, aislamiento y migraciones con PostgreSQL local. Los documentos de fases anteriores se conservan como referencia histórica.
