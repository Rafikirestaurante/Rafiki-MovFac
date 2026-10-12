# Rafiki MF 1.10.0 — Fases 5G y 5I

Base: entrega 1.9.0, Fase 5F. La 5H queda fuera de esta entrega por petición del usuario.

## Cambios

### 5G
- Movimientos: hasta cinco correos por petición; facturas: hasta dos. Cada correo terminado guarda el avance en PostgreSQL.
- El navegador continúa solicitando los lotes hasta terminar. La consulta Gmail y las fechas quedan fijadas en la primera petición.
- Si se pierde la respuesta o se cierra la pestaña, Configuración → Avance de sincronización permite continuar la misma ejecución. La reserva de una petición interrumpida vence después de tres minutos; entonces pulsa Consultar avance.
- Las reservas se adquieren bajo bloqueo del workspace. Otra cuenta no puede retomar una ejecución ajena. Movimientos y facturas del mismo workspace se serializan.
- Gmail: timeout de 15 segundos por intento y hasta tres intentos ante fallos de red, 429 y 500/502/503/504. Los errores por correo quedan en el diagnóstico y permiten terminar el resto del recorrido.
- Avance separado de Bancolombia y Nequi en Configuración: revisados, sin regla y errores de extracción.
- Cerrar búsqueda pendiente libera una búsqueda interrumpida sin eliminar movimientos ni facturas. Se rechaza mientras existe un lote reservado.
- Se conservan los límites actuales por búsqueda: 20/120/500 correos para 1/6/24 horas, 500 por rango y 150 de facturación. Si Gmail indica más resultados, se marca `truncated`; reduce el rango para recuperar los restantes.
- Los límites por lote reducen la duración de cada petición; un correo con muchos adjuntos todavía puede exceder el tiempo disponible del proveedor. Debe validarse con mensajes reales.
- No existe un trabajador en segundo plano nuevo: cerrar el navegador pausa la continuación hasta volver a solicitarla.

### 5I
- Nueva opción Reportes en el menú.
- Consulta movimientos por fechas, banco, tipo, texto de detalle/referencia y valor mínimo/máximo.
- Páginas de 50 registros y totales calculados sobre todos los movimientos filtrados, con desglose por banco.
- CSV con los mismos filtros, hasta 10.000 registros, sin limitarlo a la página visible. Protege celdas que podrían interpretarse como fórmulas.
- La consulta usa RLS con la sesión del usuario. No acepta un workspace elegido por el navegador.
- El CSV detecta cambios de cantidad y filas repetidas durante la paginación. No ofrece una instantánea transaccional entre peticiones; evita exportar mientras una sincronización esté modificando los mismos datos.
- El balance corresponde a movimientos reconocidos: ingresos menos los demás tipos de salida. No implica conciliación ni verificación diaria. No se agregan reportes de facturas en esta entrega.

## Instalación, en orden

1. Confirma que la migración de 5F `supabase/2026-10-12-fase5f-isolation.sql` ya está aplicada. El trigger mostrado anteriormente por sí solo no demuestra que todas las políticas estén instaladas. Usa el preflight de 5F si hay dudas.
2. En el SQL Editor del Supabase conectado a esta aplicación, ejecuta completo `supabase/2026-10-12-fase5g-batches.sql`.
3. Ejecuta completo `supabase/2026-10-12-fase5i-reports.sql`.
4. Solo después, actualiza el código y despliega las Edge Functions y el frontend. El workflow existente despliega funciones automáticamente al subir cambios de funciones a main; por eso los SQL deben aplicarse primero. Como mínimo cambiaron `gmail-sync-now`, `gmail-sync-invoices` y su módulo compartido.
5. Espera el despliegue de Vercel y actualiza la PWA. Configuración debe indicar 1.10.0, Fases 5G y 5I.

Ambos SQL son repetibles. No se han ejecutado sobre producción desde este trabajo.

## Prueba de aceptación

1. Desactiva temporalmente la sincronización automática para observar una búsqueda manual con más de cinco correos.
2. Desde otra pestaña de Configuración consulta el avance. Cierra la pestaña que sincroniza y, una vez vencida la reserva, continúa. Debe conservar el mismo número de ejecución y los movimientos ya creados.
3. Ejecuta nuevamente el mismo rango: los movimientos existentes deben quedar como duplicados, no volver a crearse.
4. Repite con facturas y con ambos bancos seleccionados. Revisa las notificaciones sin regla en Movimientos.
5. En Reportes filtra por Nequi y fecha; compara cantidades y valores con los movimientos. Exporta un resultado de más de 50 filas y verifica que incluya todas las páginas.
6. Repite con la segunda cuenta cuando Google permita su conexión. Debe ver solo sus ejecuciones y reportes. Esta validación real de 5F sigue pendiente.

## Validación local

- Suite de aplicación y Edge Functions simuladas: recuperación, pérdida de red, bloqueo local, filtros, CSV y reglas bancarias.
- PostgreSQL local con PGlite: migraciones repetidas, políticas heredadas, dos cuentas, reservas, expiración, recuperación y totales de reportes.
- Lint, validación de importaciones/sintaxis y compilación Vite.
- No prueba credenciales Gmail reales, concurrencia de producción, límites reales del proveedor ni el esquema completo de Supabase. Las fases quedan listas para validación desplegada; no se declara cierre técnico de producción.

Para reproducir: `npm install`, `npm run check`. La dependencia PGlite está declarada en package.json. El ZIP no contiene node_modules ni dist.

Resultado de la validación de esta entrega: 49 pruebas de aplicación, 67 comprobaciones PostgreSQL, lint, validación estructural y compilación aprobados.
