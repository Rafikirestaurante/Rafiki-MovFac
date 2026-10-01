# Rafiki MF — Fase 5

## Identificación

- Versión: `1.5.0`
- Fase activa: `Fase 5`
- Nombre: interfaz compacta y movimientos paginados

## Cambios principales

- Se retiró la vista pública de empleados de la aplicación web.
- La navegación principal usa un menú lateral desplegable mediante botón.
- Movimientos conserva las opciones de sincronización manual y por rango de fechas en un bloque compacto.
- La búsqueda manual mantiene las ventanas de 1, 3 y 6 horas.
- El listado de movimientos muestra 50 registros por página después de aplicar filtros.
- Se conserva la sincronización automática separada de movimientos y facturas.

## Regla de nombres

Los nuevos archivos y entregables de esta etapa deben incluir `FASE5` o `FASE-5` en su nombre cuando representen documentación, resúmenes o paquetes de la fase activa.

Los archivos de migraciones y documentos de fases anteriores mantienen sus nombres históricos para conservar el orden de ejecución y las referencias existentes.

## Instalación

Este proyecto no utiliza `package-lock.json` ni `npm ci`.

```bash
npm install --package-lock=false
```
