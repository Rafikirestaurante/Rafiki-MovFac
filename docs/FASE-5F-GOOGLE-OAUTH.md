# Preparación de Google OAuth — Fase 5F

No se cambió el estado del proyecto Google ni se envió solicitud de verificación.

Rafiki solicita gmail.readonly y procesa correos en Edge Functions de Supabase. Google clasifica ese permiso como restringido; la verificación y, cuando corresponda, evaluación de seguridad deben revisarse antes de ampliar el servicio públicamente. Publicar el ZIP o cambiar el estado a Producción no sustituye esos requisitos.

Preparar en el proyecto del Client ID real: nombre e identidad Rafiki, contacto de soporte, dominios verificados, portada y política de privacidad públicas con tratamiento real de Gmail, justificación de lectura de alertas y facturas, vídeo del flujo OAuth y uso del permiso, procedimiento de desconexión/eliminación y pruebas de aislamiento. Faltan confirmar dominio, datos del responsable, política de retención y configuración real del proyecto. No se inventaron ni publicaron esos datos.

Mientras se valida: usar usuarios de prueba autorizados en Google y en Rafiki. Revisar expiración de autorización en modo Testing. Evitar presentar el servicio como públicamente verificado.

Fuentes oficiales consultadas el 12/10/2026:
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://developers.google.com/identity/protocols/oauth2
