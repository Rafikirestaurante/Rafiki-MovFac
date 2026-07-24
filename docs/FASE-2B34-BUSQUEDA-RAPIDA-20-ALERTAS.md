# Fase 2B.3.4 — Búsqueda rápida de 20 alertas

Versión: **1.2.7**

## Cambio principal

Movimientos, Configuración y la PWA **Rafiki Empleados** usan un único botón **Búsqueda rápida**.

La operación:

- consulta solamente `alertasynotificaciones@an.notificacionesbancolombia.com`;
- limita la ventana a la última hora exacta;
- procesa como máximo las 20 alertas más recientes;
- mantiene el control de duplicados;
- actualiza la lista al finalizar;
- conserva la búsqueda histórica por fechas en el panel administrativo;
- Nota histórica: aquí se mantenía un límite de una solicitud por minuto; la versión 1.3.2 / Fase 3A.1 lo retiró.

No requiere SQL nuevo. Debe redesplegarse `gmail-sync-now` y se recomienda redesplegar `employee-public-access`.

> **Actualización Fase 3A.3:** este documento conserva la regla histórica de la Fase 2B.3.4. La operación vigente permite ventanas de 1, 3 y 6 horas. Consulta `FASE-3A3-BUSQUEDAS-1-3-6-HORAS.md`.
