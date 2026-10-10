# Entrega Fase 5A/5B

Base aislada: `1.4.9-FASE4B-OPCIONES-COMPACTAS-2026-10-01.zip`.

## Incluido
- `supabase/2026-10-10-fase5ab-workspaces-users.sql`: migración aditiva para workspaces, membresías, asociación conservadora de datos, RLS y `authorized_users`.
- Panel `Administración → Usuarios` para autorizar, desactivar y reactivar correos.
- El panel solo opera sobre `authorized_users`; no consulta movimientos, facturas ni Gmail.

## Supabase (manual)
1. Exporta respaldo de `financial_movements`, `electronic_invoices`, `daily_verifications`, `gmail_sync_runs`, `processing_errors` y `gmail_integration_audit`.
2. Revisa el SQL y ejecútalo en staging primero. No fue ejecutado por esta entrega.
3. Verifica que el primer usuario de `auth.users` sea el propietario esperado; la migración asigna sus registros existentes a su workspace.
4. Prueba RLS con dos usuarios y confirma que cada uno solo ve su workspace.
5. Para rollback, restaura el respaldo y elimina las políticas/tablas/columnas indicadas al final del SQL.

No se modifican Edge Functions ni se despliegan migraciones. Credenciales, OAuth y despliegue quedan fuera de esta entrega. `npm install` no pudo completar en el entorno aislado por falta de acceso al registro; no se generó `package-lock.json`.
