# 1.8.12 — Diagnóstico en Configuración

Se verificaron los archivos públicos de https://rafiki-mf.vercel.app/ el 12 de octubre de 2026. El servidor entrega versión 1.8.11 y contiene workspace_sync_diagnostic y el panel en Movimientos, fuera de Opciones. Configuración no incluía el componente. No se pudo inspeccionar la pantalla autenticada, porque el navegador de revisión mostró inicio de sesión.

Corrección: añadir SyncDiagnostic inmediatamente debajo del encabezado de Configuración, sin condición de rol. Mantenerlo en Movimientos. Abrir el panel inicialmente y mostrar la versión aun antes de consultar. Consultar continúa siendo una acción manual; no inicia sincronización.

Verificación: cuatro pruebas de renderizado pasaron (Configuración con platform_admin, workspace_owner y reviewer; acceso fuera de Opciones en Movimientos). Compilación de interfaz aprobada. Sin verificación de datos reales, despliegues o migraciones.

Publicar el código 1.8.12 usando el procedimiento habitual. Confirmar Configuración → Diagnóstico avanzado de sincronización → Versión 1.8.12. Luego pulsar Actualizar diagnóstico. Esta corrección no modifica la función SQL ni resuelve por sí sola los errores pendientes de sincronización.
