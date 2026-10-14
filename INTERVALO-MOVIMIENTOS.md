# Intervalo de sincronización de movimientos

Preparado sobre la entrega 1.12.0 de fase 6B. El parche incluye únicamente App.jsx, AppShell.jsx, MovementSyncInterval.jsx y app.css, respetando sus rutas dentro de src.

El engranaje junto al indicador de Movimientos abre las opciones 10 segundos, 30 segundos y 1 minuto. La selección se aplica a la primera consulta y a las siguientes comprobaciones automáticas; el intervalo cuenta entre intentos, y un trabajo en curso conserva la protección frente a solicitudes simultáneas. La duración de una sincronización depende del trabajo pendiente.

La preferencia se guarda por usuario en este navegador y comienza en 10 segundos. Puede seleccionarse con Movimientos desactivados; no activa la sincronización por sí sola. Facturas conserva su intervalo de 60 segundos.

Subir el contenido del ZIP al repositorio conservando las carpetas y esperar el despliegue. No requiere SQL ni cambios en Google o Supabase. La versión técnica permanece en 1.12.0.
