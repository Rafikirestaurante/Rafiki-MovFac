# Fase 3A.3 — Búsquedas Bancolombia de 1, 3 y 6 horas

Versión: **1.3.4**.

## Objetivo

Agregar dos alternativas junto a **Búsqueda rápida** tanto en la pantalla **Movimientos** como en `/empleados`, conservando la búsqueda de una hora y sumando ventanas exactas de tres y seis horas.

## Reglas

Las tres opciones consultan exclusivamente mensajes enviados por:

`alertasynotificaciones@an.notificacionesbancolombia.com`

La ventana se calcula desde el instante exacto en que se ejecuta la búsqueda:

- **Búsqueda rápida:** última 1 hora; máximo 20 alertas.
- **3 horas:** últimas 3 horas; máximo 60 alertas.
- **6 horas:** últimas 6 horas; máximo 120 alertas.

Los límites crecen proporcionalmente para que ampliar la ventana no mantenga artificialmente el tope de 20 correos de una hora.

## Seguridad y consistencia

- El backend solo acepta `quick_hours` igual a `1`, `3` o `6`; cualquier otro valor se normaliza a `1`.
- Gmail se consulta con `after:<timestamp>` para respetar la ventana horaria exacta.
- Cada mensaje se vuelve a verificar por `internalDate` antes de procesarlo.
- Se conserva el control de duplicados existente.
- Los formatos Bancolombia no reconocidos permanecen registrados para revisión administrativa.
- Sigue bloqueada únicamente una segunda sincronización si ya existe otra sincronización global en ejecución.
- `/empleados` continúa mostrando solamente los cinco movimientos más recientes después de la búsqueda.

## Base de datos

No requiere migraciones SQL nuevas ni tablas adicionales.

## Despliegue

Debe redesplegarse `gmail-sync-now`. `employee-public-access` también cambió su información de restricciones públicas y debe desplegarse junto con la versión.
