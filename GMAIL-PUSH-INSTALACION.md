# Fase 6C — sincronización por avisos Gmail, 1.12.0

Estado: paquete local preparado; requiere configurar los servicios, desplegar, aplicar SQL y probar un correo real antes de considerarlo activo.

## Recursos previstos

- Proyecto Google Cloud: rafiki-mf, el mismo del cliente OAuth.
- Tema: projects/rafiki-mf/topics/rafiki-gmail-events.
- Suscripción push: projects/rafiki-mf/subscriptions/rafiki-gmail-events-supabase.
- Cuenta de servicio para firmar avisos: rafiki-gmail-push@rafiki-mf.iam.gserviceaccount.com, sin permisos de lectura de Gmail.
- Gmail publica en ese tema mediante gmail-api-push@system.gserviceaccount.com; conceder únicamente Pub/Sub Publisher en ese tema.
- Receptor: https://rqkhefontkypaxiiglbo.supabase.co/functions/v1/gmail-push-webhook.
- Suscripción con autenticación OIDC, identidad anterior y audiencia exactamente igual al receptor. Conceder al agente de servicio de Pub/Sub el permiso para generar el token de esa cuenta de servicio cuando lo solicite Google; no conceder privilegios sobre Gmail, Supabase ni usuarios.

Revisar facturación y requisitos de Google Cloud antes de activar recursos que requieran pago. No hay claves de servicio descargables necesarias para recibir los avisos.

## Instalación

1. Subir todos los archivos de esta entrega al repositorio, incluida .github/workflows. El workflow despliega once Edge Functions: ocho existentes y tres push.
2. Ejecutar supabase/2026-10-14-fase6c-gmail-push.sql. Esta migración no activa avisos por sí sola y reserva el estado únicamente para service_role.
3. Configurar tema, publicación Gmail, identidad y suscripción autenticada en Google Cloud.
4. Configurar los secretos Edge:
   - GMAIL_PUSH_TOPIC = projects/rafiki-mf/topics/rafiki-gmail-events
   - GMAIL_PUSH_SUBSCRIPTION = projects/rafiki-mf/subscriptions/rafiki-gmail-events-supabase
   - GMAIL_PUSH_IDENTITY_EMAIL = rafiki-gmail-push@rafiki-mf.iam.gserviceaccount.com
   - GMAIL_PUSH_AUDIENCE = https://rqkhefontkypaxiiglbo.supabase.co/functions/v1/gmail-push-webhook
5. Ejecutar supabase/2026-10-14-fase6c-push-cron.sql. Crea una clave privada en Vault y el cron de recuperación cada minuto. Copiar la clave desde Vault a GMAIL_PUSH_WORKER_SECRET en secretos Edge dentro del panel Supabase. No enviarla por chat, frontend o GitHub. El cron y Edge deben usar exactamente la misma clave.
6. En Configuración, activar avisos para movimientos, facturas o ambos. La activación llama a Gmail watch; sus permisos siguen siendo gmail.readonly. Si Google o la suscripción falla, se muestra el error y no se declara activado.

## Funcionamiento y límites

El webhook verifica la firma Google, emisor, audiencia, correo verificado de la cuenta de servicio y nombre de suscripción. Guarda el aviso antes de responder 204 para que Google pueda repetir entregas fallidas. No confía en IDs de workspace recibidos desde Google.

El trabajador valida que el propietario siga activo y autorizado, y que la conexión Gmail corresponda al workspace. Consulta history.list desde el cursor persistido, guarda la página y procesa sus mensajes usando los mismos extractores y deduplicación de las búsquedas manuales. Movimientos conserva cinco correos por lote; facturas, dos. Los lotes pendientes se continúan en el servidor sin depender del navegador. Se evita adelantar el cursor cuando hay errores técnicos.

El primer aviso puede referirse a un correo que no es bancario; las reglas filtran por los bancos de ese workspace. Gmail puede avisar de todo el buzón, pero la aplicación no convierte todos esos correos en movimientos.

Se renueva watch cuando faltan menos de 48 horas de vigencia. Cada 15 minutos sin trabajo se consulta el historial como respaldo. El cron despierta trabajos persistidos y recupera reservas vencidas. Si el historial caducó (404), se detiene el avance y se muestra una indicación para recuperar el rango manualmente y reactivar push. No se descarta el hueco silenciosamente.

Activar push comienza desde el historial actual: los correos anteriores se recuperan con las búsquedas manuales existentes. La elección de movimientos/facturas es propia de push; el interruptor del indicador corresponde a la comprobación del navegador, que puede mantenerse como respaldo o desactivarse.

No hay envío instantáneo de cambios a la pantalla del navegador ni notificaciones del sistema: push actualiza PostgreSQL desde el servidor. La pantalla utiliza su recarga habitual para mostrar datos.

Cuando se desconecta o cambia la cuenta Gmail, un trigger desactiva el estado push para impedir que la cuenta nueva herede el cursor anterior. El siguiente acceso puede activar una nueva suscripción.

## Prueba real pendiente

Enviar/recibir un aviso bancario de prueba con la app cerrada; comprobar el movimiento en el workspace correcto, repetir la entrega Pub/Sub y comprobar que no duplica, simular un lote interrumpido y verificar recuperación, desactivar y comprobar que no procesa nuevos avisos. Probar también factura y segunda cuenta autorizada. No dar por cerrada la fase mientras estas comprobaciones estén pendientes.

## Fuentes

- https://developers.google.com/workspace/gmail/api/guides/push
- https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
- https://supabase.com/docs/guides/database/extensions/pg_net
- https://supabase.com/docs/guides/cron
