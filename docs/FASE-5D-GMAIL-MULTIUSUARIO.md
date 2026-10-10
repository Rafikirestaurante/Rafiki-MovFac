# Fase 5D — Gmail independiente por usuario

El código actual todavía consulta una única conexión `principal`. El primer paso de esta fase añade `workspace_id` a `gmail_connections`, conserva la conexión existente en el workspace propietario y prepara el aislamiento RLS.

La migración no adapta todavía las Edge Functions. Antes de ejecutarla en producción hay que actualizar OAuth, estado, diagnóstico, desconexión y sincronizaciones para resolver siempre el workspace del usuario autenticado. Mantener los intervalos de movimientos (10 segundos) y facturas (60 segundos) después de esa adaptación.
