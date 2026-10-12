# Corrección del validador de funciones — 1.11.0

El log de Vercel confirma que las pruebas y PostgreSQL local pasaron. La validación posterior fallaba porque exigía que supabase/functions contuviera exactamente ocho carpetas más _shared. Una carpeta histórica o temporal adicional era suficiente para bloquear el build.

La validación ahora exige y revisa las ocho funciones utilizadas por esta entrega y _shared. Las carpetas adicionales se enumeran como aviso con sus nombres y quedan fuera del análisis de sintaxis/importaciones de esta entrega. El workflow mantiene el despliegue explícito de las ocho funciones actuales.

Las pruebas reproducen un checkout con una función histórica cuyo import ya no existe y una carpeta .temp. El build de validación pasa con esas carpetas y sigue fallando si falta gmail-sync-now/index.ts.

Instalar el parche conservando sus rutas: scripts/validate-project.mjs y tests/projectValidation.test.js. Volver a desplegar Vercel. No cambia versiones, SQL ni Edge Functions.

El aviso de carpetas adicionales no confirma cuáles están desplegadas en Supabase. Si corresponden a funciones retiradas, revisar por separado su publicación y permisos. No se deduce su contenido a partir del log recibido.
