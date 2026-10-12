# 1.8.13 — Ambos remitentes Bancolombia

Se aceptan exclusivamente alertasynotificaciones@an.notificacionesbancolombia.com y alertasynotificaciones@ayn.notificacionesbancolombia.com. Lista compartida por reconocimiento, consulta rápida y verificador. La búsqueda usa un grupo OR en una única consulta; no duplica peticiones. Puede procesar más mensajes al incluir los antes excluidos.

Publicación necesaria:
1. Redesplegar las Edge Functions gmail-sync-now y gmail-diagnostics desde esta entrega, incluyendo _shared/bancolombia.ts. Solo publicar Vercel no actualiza estas funciones.
2. Publicar la web para mostrar versión 1.8.13.
3. Sincronización automática desactivada durante la comprobación; esperar a que finalicen ejecuciones activas.
4. Ejecutar búsqueda por fechas del 10 al 12 de octubre de 2026 para recuperar también alertas de la tarde del día 10. Últimas 24 horas no cubre todo ese intervalo.
5. Revisar diagnóstico y movimientos contra correos de ambos remitentes. Los candidatos ya detectados se vuelven a procesar; no es necesario borrarlos.

No requiere nuevas migraciones SQL. No se desplegó ni se modificaron datos de producción. El bloqueo entre sincronizaciones y la deduplicación por huella no se modificaron.

Validación: 23 pruebas aprobadas, incluyendo dirección antigua/nueva, rechazo de direcciones parecidas y consulta OR. Compilación de interfaz aprobada. No se probó Gmail real ni el runtime Edge de Supabase.
