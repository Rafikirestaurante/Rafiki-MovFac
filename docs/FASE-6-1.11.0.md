# Fase 6 — Preparación para producción · 1.12.0

Base: 1.10.0, con los SQL 5G y 5I instalados según confirmación del usuario. Las fases 5H y 5J se mantienen pendientes y no se implementan aquí.

## Qué incluye

- Configuración → Preparación para producción → Comprobar instalación. Lee controles de base y configuración del servidor sin iniciar Gmail ni escribir registros.
- Compara las versiones de web, servidor consultado y función de comprobación SQL. Detecta diferencias de despliegue y muestra los controles pendientes.
- Verifica controles concretos: RLS y políticas restrictivas instaladas, privacidad de credenciales/OAuth/lotes, exclusividad de las funciones de lotes para servidor, reportes con sesión y existencia del índice de deduplicación.
- El SQL limita la lectura de perfiles, workspaces y membresías; retira administración directa de workspaces/membresías y acceso anónimo a tablas de la aplicación. Retira también permisos por columna heredados sobre credenciales y OAuth.
- Las Edge Functions admiten únicamente los orígenes configurados en APP_PUBLIC_URL y APP_ALLOWED_ORIGINS. El JWT y la autorización siguen siendo obligatorios: CORS no sustituye la autorización.
- Tiempo máximo de 15 segundos para peticiones OAuth/perfil/revocación a Google. La revocación envía la credencial en el cuerpo y evita incluirla en la URL.
- Dependencias de herramientas actualizadas y package-lock.json distribuido. Vercel usa npm ci y ejecuta las comprobaciones completas antes de generar la web; GitHub ejecuta las comprobaciones antes de desplegar funciones.
- Cabeceras web contra incrustación, detección de tipos incorrecta y envío de referencias. No se cambia el contenido de movimientos ni facturas.

## Instalación en la aplicación existente

1. Conserva el ZIP 1.10.0 y confirma un respaldo reciente de Supabase. Guarda de forma privada la configuración y la clave de cifrado original; nunca las incluyas en GitHub ni en el ZIP.
2. En Supabase → Edge Functions → Secrets confirma APP_PUBLIC_URL = `https://rafiki-mf.vercel.app`. Si usas otras direcciones de web, agrega sus orígenes exactos, separados por coma, en APP_ALLOWED_ORIGINS. Ejemplo local: `http://localhost:5173`. No uses `*` ni una expresión genérica de previews.
3. En el SQL Editor de ese mismo Supabase ejecuta completo `supabase/2026-10-12-fase6-readiness.sql`. Es repetible y no elimina movimientos ni reasigna propietarios. Necesita la base de 5F/5G/5I. No vuelvas a ejecutar indiscriminadamente todos los SQL históricos.
4. Sube el contenido de esta entrega, incluido package-lock.json. GitHub validará y desplegará las ocho Edge Functions; Vercel validará y publicará la web. El módulo compartido cambió: desplegar solamente gmail-sync-now dejaría las otras funciones con controles diferentes.
5. Usa Node 24 en Vercel y en desarrollo (también se admite Node 22.13 o posterior de la rama 22). No omitas las dependencias de desarrollo durante el build: contienen los verificadores y el compilador.
6. Actualiza la aplicación/PWA. Configuración debe mostrar 1.12.0 y Fase 6. Pulsa Comprobar instalación. Web, servidor consultado y base deben coincidir en 1.12.0.
7. Prueba conexión Gmail, una búsqueda de movimientos, una de facturas y un reporte. Comprueba que las notificaciones sin regla siguen disponibles y el diagnóstico sigue únicamente en Configuración.

Si ves «Origen no autorizado», corrige APP_PUBLIC_URL/APP_ALLOWED_ORIGINS; no retires la comprobación. Un preview de Vercel requiere su origen exacto y no queda autorizado automáticamente.

## Qué demuestra el panel y qué falta

Un resultado correcto confirma únicamente los controles enumerados y la versión de la función consultada. No inspecciona todo el esquema, no prueba el código de todas las funciones desplegadas ni garantiza que las credenciales presentes sean válidas. La clave se comprueba por formato, no contra la clave anterior.

No confirma verificación de Google, disponibilidad de respaldos, restauración, concurrencia real ni aislamiento con dos conexiones Gmail reales. Esas evidencias siguen pendientes. No se declara la apertura pública ni el cierre de Fase 6 por tener todas las marcas del panel correctas.

### Google

La aplicación usa gmail.readonly. Antes de ampliar el acceso público, completar los requisitos de verificación aplicables al proyecto Google real. Cambiar el estado a Producción no acredita esa verificación. Confirmar los datos del responsable, contacto, dominio, política de privacidad real, retención/eliminación, vídeo del flujo y justificación del permiso. No se publicaron políticas con datos inventados ni se envió una solicitud de verificación.

Fuente: [Verificación de permisos restringidos de Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

### Respaldo y restauración

- Registrar fecha, proyecto y mecanismo del respaldo. Las opciones disponibles dependen del proyecto y plan; consultar el panel real de Supabase.
- Conservar por separado código, SQL, configuración privada, clave de cifrado original y, si se usan, archivos de Storage. El respaldo de base de datos no sustituye el respaldo de los objetos almacenados.
- Probar la restauración en un proyecto aislado, con sincronización automática desactivada. No usar una restauración de ensayo sobre la aplicación activa.
- En el entorno restaurado comprobar usuarios autorizados, movimientos, facturas, duplicados y permisos. No conectar Gmail real allí sin definir expresamente qué cuenta y proyecto se usarán.
- Registrar resultado y tiempo de recuperación. No dar el respaldo por probado únicamente porque existe un archivo.

Fuentes: [Respaldos de Supabase](https://supabase.com/docs/guides/platform/backups) y [Respaldo y restauración con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

### Recuperación ante una incidencia de esta entrega

1. Desactivar la sincronización automática y conservar el diagnóstico del workspace afectado.
2. Si el problema es solo de la web, volver a la web 1.10.0 conservando la base y los controles del servidor actuales. No borrar columnas ni tablas para volver atrás.
3. Si es un origen no autorizado, corregir la lista de orígenes y volver a probar. Si falta una migración, aplicar el SQL específico; no modificar restricciones globales a ciegas.
4. Si falla la autorización Gmail, usar el diagnóstico y reconectar cuando corresponda. No regenerar GMAIL_TOKEN_ENCRYPTION_KEY: cambiarla impide descifrar las credenciales existentes.
5. Si hay sospecha de acceso entre cuentas, detener el uso compartido y revisar permisos antes de continuar. La restauración de datos requiere valorar qué escrituras posteriores se perderían; no se automatiza desde esta entrega.

## Validación y cierre

Validación local con dependencias de esta entrega: pruebas de aplicación, CORS, configuración y peticiones Google simuladas; PostgreSQL local con políticas heredadas y dos usuarios; lint, sintaxis/importaciones, coherencia de versiones y compilación con PWA.

El registro de dependencias y npm audit corresponden a la fecha de entrega. La ausencia de avisos conocidos no garantiza ausencia de vulnerabilidades. Las comprobaciones locales no se conectaron a producción ni a Gmail real.

Para cerrar Fase 6 faltan las comprobaciones desplegadas anteriores, la prueba con dos cuentas, la restauración probada y la resolución documentada de los requisitos Google. La entrega deja preparados el código y los procedimientos; no sustituye esas pruebas.

Desarrollo y validación: `npm ci`, `npm run check`. Usar las variables públicas de Vercel para la web. No introducir service_role ni secretos Google en variables VITE_.

Resultado local de esta entrega (12/10/2026): 58 pruebas de aplicación y 80 comprobaciones PostgreSQL aprobadas; lint, validación estructural, preflight y compilación/PWA aprobados. npm audit del conjunto actualizado: cero vulnerabilidades conocidas reportadas.
