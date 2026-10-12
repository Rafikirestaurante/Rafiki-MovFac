# 1.8.14 — Pago QR desde cuenta a llave

Causa: la clasificación no incluía la frase pagaste por codigo QR. Se añade como transfer (salida), sin cambiar el esquema SQL ni las reglas de ingresos. Se extraen monto, fecha/hora Colombia, cuenta enmascarada y llave con ceros iniciales. Detalle: Pago QR a la llave 0090375843. Se conservan ambos remitentes de 1.8.13.

Ejemplo validado: $160,000.00, 11/10/2026 12:16 Colombia, cuenta *3190. Resultado: transfer, 160000 COP, 2026-10-11T17:16:00.000Z.

Publicación: redesplegar gmail-sync-now incluyendo _shared/bancolombia.ts. Publicar web para identificación 1.8.14. Sin nuevas migraciones SQL. No se ejecutaron despliegues ni modificaciones de datos.

Recuperación: desactivar temporalmente sincronización automática, esperar ejecuciones activas y buscar por fechas incluyendo 11/10/2026. Una búsqueda de 24 horas realizada el 12 después de las 12:16 ya excluye este correo. Los candidatos previamente ignorados se reprocesan; no borrarlos.

Validación: 26 pruebas aprobadas, incluyendo ejemplo QR sin/con tilde y consejos QR sin movimiento. Sin prueba de Gmail real ni runtime Edge.
