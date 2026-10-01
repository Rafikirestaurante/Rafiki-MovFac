# Fase 5 — Interfaz compacta y movimientos paginados

## Objetivo

Simplificar la operación diaria de Rafiki MF, retirar la vista de empleados y mejorar la navegación y consulta de movimientos.

## Alcance

- Menú lateral oculto por defecto y accesible mediante botón.
- Navegación entre Inicio, Movimientos, Facturas y Configuración.
- Eliminación de la interfaz web de Empleados y de su acceso desde el panel administrativo.
- Opciones de Movimientos organizadas en dos grupos compactos:
  - Sincronización manual.
  - Sincronización por rango de fechas.
- Búsqueda manual de Bancolombia mediante ventanas de 1, 3 y 6 horas.
- Paginación de 50 movimientos por página, aplicada después de filtros.

## Compatibilidad

La fase mantiene sin cambios:

- Sincronización automática de movimientos cada 15 segundos.
- Sincronización automática de facturas cada 60 segundos, desactivada por defecto.
- Alertas Bancolombia no reconocidas para revisión.
- Facturación electrónica y trazabilidad documental.
- Regla de instalación con `npm install --package-lock=false`.

## Verificación

La comprobación integral se ejecuta con:

```bash
npm run check
```

No se debe crear ni subir `package-lock.json`, `npm-shrinkwrap.json` ni ejecutar `npm ci`.
