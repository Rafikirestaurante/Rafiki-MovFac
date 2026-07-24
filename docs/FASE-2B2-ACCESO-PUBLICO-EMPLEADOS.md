# Rafiki MF — Acceso público controlado para empleados

Estado vigente después de las Fases 2B.3.2 y 2B.3.4.

## Ruta

```text
https://TU-DOMINIO-VERCEL/empleados
```

El Administrador configura desde **Configuración** un nombre de acceso y una contraseña compartida. La contraseña no se guarda en texto plano: se deriva mediante PBKDF2-SHA-256, sal aleatoria y 120.000 iteraciones.

## Restricciones actuales

- Solo devuelve los cinco movimientos más recientes.
- No expone IDs de Gmail, asuntos, remitentes, referencias técnicas ni historial completo.
- No permite abrir el panel administrativo, Gmail, facturas o configuración.
- La sesión pública dura ocho horas.
- Cambiar el nombre, la contraseña o el estado invalida las sesiones abiertas.
- La búsqueda rápida consulta solamente alertas de Bancolombia recibidas durante la última hora.
- Revisa como máximo las 20 alertas más recientes.
- Nota histórica: en esta fase la sincronización pública se limitaba a una ejecución por minuto; la versión 1.3.2 / Fase 3A.1 retiró ese límite.
- Solo los movimientos de ingreso pueden confirmarse como pagos recibidos.

## Confirmación de pagos

El trabajador escribe su nombre y, opcionalmente, una observación. La confirmación:

- queda registrada en `employee_payment_confirmations`;
- queda registrada en `document_audit_log`;
- no cambia ni elimina el movimiento bancario;
- no agrega estados de revisión a `financial_movements`;
- no puede repetirse para el mismo movimiento.

## Instalación y despliegue

1. Ejecutar `supabase/2026-07-17-fase2b2-acceso-publico-empleados.sql`.
2. Ejecutar también `supabase/2026-07-17-fase2b32-simplificacion-operativa.sql`.
3. Subir el proyecto completo a GitHub.
4. Confirmar el despliegue de:
   - `employee-access-admin`
   - `employee-public-access`
   - `gmail-sync-now`
5. Esperar el despliegue de Vercel.
6. Entrar como Administrador a Configuración.
7. Definir el nombre, la contraseña y activar el acceso.
8. Abrir y compartir `/empleados`.

## Tablas

- `employee_public_access_settings`
- `employee_payment_confirmations`
- `employee_public_access_log`

## Actualización Fase 3A.3

La operación vigente reemplaza la única ventana de una hora por tres botones disponibles en `/empleados`: **Búsqueda rápida (1 hora)**, **3 horas** y **6 horas**. Todas consultan exclusivamente el remitente oficial de alertas Bancolombia. Los límites son 20, 60 y 120 alertas respectivamente. No existe espera de un minuto entre ejecuciones; solo se impide iniciar otra sincronización mientras una global siga en curso.
