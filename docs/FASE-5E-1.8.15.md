# 1.8.15 — Alertas para revisión e interfaz

1. La búsqueda rápida y el verificador incluyen correos del dominio notificacionesbancolombia.com con asunto Alertas y Notificaciones, además de los dos remitentes conocidos. Nuevos remitentes se registran como unsupported_notification, requires_review y source_detected bancolombia para el aviso existente del calendario. No crean movimientos automáticamente. Los remitentes conocidos mantienen extracción y aviso si la regla no existe.
2. Diagnóstico solo en Configuración, inmediatamente después del bloque Sincronización Gmail. Movimientos conserva los avisos de error existentes.
3. Eliminado recuadro Último movimiento. Se conserva listado y resaltado de primera fila.

Publicación: redesplegar gmail-sync-now y gmail-diagnostics incluyendo _shared/bancolombia.ts. Publicar web 1.8.15. Sin migraciones SQL. No se realizó despliegue ni cambios de producción.

Para recuperar alertas ya pasadas, sincronizar por fechas. El aviso existente se muestra en el detalle del día del calendario. No se implementaron notificaciones por correo ni push.

Validación: 27 pruebas aprobadas. Incluyen detección de dominio/subdominio y rechazo de dominio parecido, ubicación del diagnóstico y exclusión de Movimientos. Sin prueba de Gmail real ni runtime Edge.
