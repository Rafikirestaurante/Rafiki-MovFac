# Cronograma — Rafiki Movimientos y Facturas

## Estado actual

Versión vigente: **1.3.2 — Fase 3A.1**

Base oficial: proyecto independiente Rafiki MF, completamente separado de Rafiki Pedidos.

## Fase 1 — Infraestructura independiente — Completada

- React 18 + Vite y PWA interna.
- Proyecto Supabase independiente.
- Autenticación y roles.
- Tablas documentales.
- Google Cloud, Gmail API y OAuth 2.0.
- Edge Functions de conexión segura.

## Fase 2 — Lectura y procesamiento real de Gmail — Completada

### 2A — Motor de sincronización manual

- Consulta de Gmail por rango de fechas.
- Renovación del token.
- Registro de ejecuciones, candidatos y errores.
- Control de ejecución simultánea.

### 2B a 2B.3.4 — Bancolombia, diagnóstico y empleados

- Alertas de Bancolombia.
- Fecha, hora, valor, detalle y referencia.
- Sincronización histórica y búsqueda rápida.
- Diagnóstico de Gmail y Edge Functions.
- Acceso restringido `/empleados`.
- PWA independiente Rafiki Empleados.
- Consulta máxima de cinco movimientos.
- Búsqueda Bancolombia de 1, 3 y 6 horas exactas (20/60/120 alertas).
- Confirmación separada de pagos recibidos.

### 2D — Facturación electrónica

- Detección de ZIP, XML y PDF.
- Lectura de XML UBL.
- Proveedor, NIT, número, CUFE, fechas y valores.
- Registro controlado de documentos incompletos.
- Control de duplicados y enlace al correo original.

## Fase 3 — Consolidación operativa

### 3A — Estabilización de la base — Completada en versión 1.3.1

- Documentación consolidada.
- Versión centralizada.
- Validador estructural reforzado.
- Comando integral de pruebas.
- Revisión de instalación, compilación y despliegue.

### 3A.1 — Ajustes operativos y calendario — Completada en versión 1.3.2

- Retiro del rate limit de una búsqueda pública por minuto en `/empleados`.
- Conservación obligatoria de alertas Bancolombia no reconocidas para revisión.
- Calendario mensual en Inicio para consultar actividad de días anteriores.
- Resumen diario de movimientos, ingresos, salidas, facturas y alertas por revisar.
- Sin nuevas migraciones SQL ni dependencias.

### 3B — Integración real de Nequi — Próxima

- Procesar `notificaciones@nequi.com.co` y `somos@nequi.com.co`.
- Diferenciar ingresos, transferencias y pagos.
- Interpretar fechas en español y abreviadas.
- Crear pruebas automatizadas y control de duplicados.

### 3C — Motor unificado de sincronización

- Unificar Bancolombia, Nequi y facturas.
- Estado por fuente.
- Reintentos y reanudación segura.
- Detalle de cada ejecución.

### 3D — Verificación diaria

- Estados Pendiente, Verificado y Descartado.
- Observaciones, responsable y fecha de revisión.
- Acciones individuales y masivas.

### 3E — Dashboard e historial

- Indicadores operativos.
- Búsqueda avanzada.
- Filtros y exportación.

### 3F — Fortalecimiento de facturación electrónica

- Variantes UBL.
- Notas crédito y débito.
- Asociación XML/PDF.
- Mejor tratamiento de archivos dañados o incompletos.

### 3G — Seguridad, roles y auditoría

- Revisión completa de RLS.
- Auditoría de operaciones sensibles.
- Protección de funciones y credenciales.

### 3H — Automatización y cierre operativo

- Sincronizaciones programadas.
- Alertas por fallos.
- Centro de errores.
- Pruebas integrales y versión estable 2.0.0.
