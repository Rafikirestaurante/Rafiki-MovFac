# 1.8.10 — Fase 5D — Diagnóstico

1. Respaldar antes de cualquier cambio de base.
2. Aplicar SOLO `supabase/2026-10-12-diagnostico-workspace.sql` en staging y validar primero. Crea una función de lectura; no elimina ni modifica movimientos.
3. Publicar la web después de compilar con npm install --no-package-lock y npm run build.
4. Abrir Movimientos → Opciones → Diagnóstico avanzado de sincronización → Actualizar diagnóstico.
5. Copiar diagnóstico permite compartir versión, conteos y errores. No incluye tokens OAuth ni cuerpos de correos. Los mensajes se filtran, pero revisar el reporte antes de compartir.

La consulta solo usa auth.uid() y el workspace propio activo; no acepta workspace_id del navegador. Consulta errores mediante su ejecución asociada, incluso si processing_errors.workspace_id está vacío. No concede permisos para leer otras cuentas. No necesita redesplegar Edge Functions para el panel.

Validar con dos sesiones: cada usuario debe ver solo su historial; sin sesión debe ser rechazado. Probar reporte, errores vacíos, históricos y fallo de conexión. SQL no ejecutado por esta entrega.

Límites: no detecta automáticamente errores de arranque que no lleguen a registrarse, ni ejecuta reparaciones. Los errores antiguos guardados como [object Object] no son recuperables. Código sin compilar en este entorno: faltan Vite, ESLint y Vitest; los tres comandos se intentaron y fallaron por herramientas ausentes. La sincronización multiusuario todavía requiere auditoría integral independiente; este panel no certifica su aislamiento.

Rollback: retirar componente de Opciones y ejecutar drop function public.workspace_sync_diagnostic();
