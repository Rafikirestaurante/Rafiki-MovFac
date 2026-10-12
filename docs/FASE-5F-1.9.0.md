# Fase 5F — 1.9.0 — Primera entrega para staging

Base: 1.8.16. No se ha instalado en Supabase ni Vercel. No declara cerrada la fase.

## Cambios

- Contexto Gmail exige perfil activo, autorización activa y workspace propio activo. Administrador de plataforma reservado a rafiki.restaurante@gmail.com.
- Estado, diagnósticos, credenciales, errores y candidatos filtrados por workspace. Facturas dejan de usar control de ejecución y candidatos globales. Errores de deduplicación/guardado de candidatos ya no se ignoran.
- RLS restrictiva sobre tablas financieras y Gmail limita políticas permisivas históricas. Credenciales no se consultan directamente desde el navegador. Auditoría documental histórica sin workspace no se expone al navegador.
- Restricciones globales conocidas de movimientos y facturas se reemplazan por índices dentro del workspace, en una transacción. Las colisiones abortan; no se borran movimientos.
- Inicio de sincronización serializado con bloqueo de fila del workspace: consulta de ejecución activa y alta ocurren en una sola transacción para ambos endpoints. A los 30 minutos sin cierre una ejecución se registra como interrumpida antes de permitir otra. No hay cancelación ni reanudación por lotes todavía.
- Consultas automáticas esperan mientras hay otra sincronización desde la misma pestaña. El control de base cubre otras pestañas/dispositivos.
- Duplicados contabiliza movimientos, sin sumar otra vez correos candidatos. Sin referencia bancaria no se descarta un correo diferente solo por coincidir monto, persona y día; se mantiene deduplicación por mensaje.
- Preferencias Bancolombia/Nequi persistidas en workspace mediante RPC; el backend las consulta. Por defecto Bancolombia. Preferencias locales anteriores no se migran automáticamente: volver a seleccionar bancos después de instalar.
- Un único trigger de alta sustituye tres triggers históricos conocidos. Requiere correo autorizado y crea perfil, workspace y membresía propios. Retirar autorización bloquea nuevas consultas y funciones; no cancela trabajo ya iniciado.
- Validador actualizado a versión 1.9.0 y ocho funciones actuales; workflow deja de intentar desplegar módulos de empleados retirados.

## Instalación en staging

1. Crear copia/respaldo de esquema y datos. Desactivar sincronizaciones y esperar ejecuciones en curso.
2. Ejecutar solo lectura supabase/2026-10-12-fase5f-preflight.sql. Resolver usuarios activos sin autorización, propietarios inconsistentes, datos sin workspace y colisiones. No asignar por defecto todo al primer usuario. Auditar cualquier trigger adicional no contemplado.
3. Aplicar supabase/2026-10-12-fase5f-isolation.sql completo. Requiere tablas y columnas workspace de las fases previas, además de document_key y membresías. Es transaccional; si falla revisar el error completo. No ejecutar de nuevo todas las migraciones históricas.
4. Redesplegar las ocho funciones Gmail y todos los archivos _shared desde esta entrega. Publicar web 1.9.0. No mezclar funciones antiguas con migración nueva.
5. Con dos cuentas autorizadas, comprobar que cada una solo ve sus movimientos, facturas, errores e historial. Probar consultas directas con JWT del usuario; SQL Editor administrativo evita RLS y no sirve para esta prueba.
6. Iniciar movimiento/factura al mismo tiempo en el mismo workspace: una ejecución debe esperar/rechazarse con 409 y active_run_id. Otro workspace puede continuar. Comprobar recuperación después de fallo. No se han realizado pruebas reales de carga o interrupción del runtime.
7. Guardar bancos en un dispositivo y verificar en otro; comprobar que Gmail busca los elegidos. Repetir correo de Nequi y pago QR para validar que no duplica.
8. Desactivar autorización de la segunda cuenta y comprobar que no puede consultar datos, preferencias, diagnóstico ni reconectar Gmail. Restaurarla solo si corresponde.
9. Solo después de estos resultados preparar la publicación en producción.

## Reversión

No retirar únicamente la barrera RLS ni restaurar código antiguo mientras hay actividad. Detener sincronizaciones y restaurar conjuntamente código/esquema desde el respaldo verificado. Los registros nuevos y cambios de índices requieren reconciliación; no se incluye un rollback que borre datos o reabra accesos.

## Validación y límites

Pruebas de aplicación y endpoint con mocks, PostgreSQL aislado PGlite con esquema reducido y dos usuarios, lint, validador de sintaxis/imports y compilación. Las comprobaciones de base incluyen políticas históricas permisivas, credenciales, preferencias, bloqueo, usuario inactivo, autorización retirada, alta autorizada/no autorizada e idempotencia de la migración.

El esquema aislado no reproduce todos los triggers, índices, extensiones ni políticas del proyecto desplegado. Falta validación con Supabase/Gmail real, carga concurrente real, revisión de procedencia histórica, lotes/reanudación y verificación Google. Las consultas legacy ya reasignadas por migraciones anteriores no pueden corregirse sin evidencia de su propietario.

Reproducir después de npm install: npm run check. PGlite es dependencia de desarrollo, no entra al paquete web. La ejecución de pruebas SQL no usa credenciales ni red a Supabase.

Resultado local final: 38 pruebas de aplicación aprobadas; 39 comprobaciones PostgreSQL aprobadas; lint, estructura/sintaxis e interfaz/PWA compiladas correctamente. Las pruebas SQL usan un esquema reducido e incluyen dos ejecuciones consecutivas de la migración.

