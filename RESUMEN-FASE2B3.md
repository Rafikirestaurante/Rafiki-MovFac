# Resumen — Rafiki MF 1.2.3 / Fase 2B.3

La Fase 2B.3 mejora el diagnóstico y la velocidad de lectura de Gmail.

## Diagnóstico

Se creó la Edge Function `gmail-diagnostics`, que verifica el registro de conexión, la credencial cifrada, el descifrado, la renovación del token, la lectura del buzón y la búsqueda real de alertas Bancolombia. Configuración muestra cada verificación, el último error guardado, los errores técnicos recientes y las alertas encontradas cuyo formato aún no pudo convertirse en movimiento.

## Sincronización rápida

Se agregaron las opciones de 2, 6 y 12 horas en Configuración y Movimientos. La opción predeterminada es 2 horas. La búsqueda rápida consulta únicamente el remitente autorizado de Bancolombia, utiliza una hora de inicio exacta, valida la fecha interna del mensaje y procesa como máximo 100 correos.

La sincronización por rango de fechas permanece disponible como herramienta histórica.

## Instalación

Esta fase no requiere SQL nuevo. Se debe subir el proyecto a GitHub y confirmar en Actions el despliegue de:

- `gmail-connection-status`
- `gmail-diagnostics`
- `gmail-sync-now`

Después debe completarse el despliegue de Vercel.
