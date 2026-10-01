# Fase 4A — Automatización, PWA y alertas Bancolombia

## Cambios incorporados

- Versión oficial: `1.4.0`.
- La aplicación conserva la instalación PWA mediante `vite-plugin-pwa`, actualización automática del service worker, manifest, iconos y soporte para `/empleados`.
- Las alertas Bancolombia cuyo formato no coincide con una regla se registran en `gmail_sync_candidates` con estado `ignored`, sin insertar filas en `financial_movements`.
- Se conserva el remitente, asunto, fecha, fragmento y texto completo de la notificación para revisión.
- El ejemplo de pago por código QR queda disponible como alerta no reconocida hasta crear una regla específica y validada.
- Se agregan índices para consultar rápidamente alertas pendientes de revisión.

## Criterio de seguridad

Una notificación no reconocida nunca se convierte automáticamente en movimiento. Primero se revisa el formato y luego se incorpora una regla acompañada de pruebas.
