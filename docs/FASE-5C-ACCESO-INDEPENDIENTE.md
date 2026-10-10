# Fase 5C — acceso independiente

La migración `2026-10-10-fase5c-acceso-independiente.sql` valida el correo autorizado al crear una cuenta y provisiona un workspace personal con su membresía de propietario. Los usuarios no autorizados son rechazados por la base de datos; la seguridad no depende solo de React.

Ejecutar únicamente en staging, después de 5A/5B y con respaldo de `auth.users`, `app_users`, `authorized_users`, `workspaces` y `workspace_members`. Probar un correo autorizado y uno desactivado antes de producción. No incluye todavía la conexión Gmail independiente de cada usuario; eso corresponde a 5D.
