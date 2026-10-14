# Corrección del build de 1.12.0

Las pruebas de credenciales ejecutaban todo el preflight del repositorio. Un fallo previo, como la ausencia de `.github` en el checkout del proveedor, hacía fallar la prueba de clave pública y la prueba del mensaje de clave privada, mientras la prueba de JWT privado podía pasar por el motivo equivocado.

Se separa la validación de credenciales en `scripts/public-key-check.mjs` y se prueba directamente. Se incluyen pruebas de integración con un checkout temporal sin `.github`: Vercel puede validar la entrega, la revisión local sigue exigiendo el workflow y una clave privada sigue bloqueando el build.

`validate-project.mjs` y `release-preflight.mjs` permiten la ausencia del workflow únicamente cuando VERCEL=1. Si el archivo está presente, se comprueba su contenido incluso en Vercel. GitHub y desarrollo siguen comprobándolo normalmente.

No se quitan pruebas ni se sustituye `npm run check`. Se mantiene la versión 1.12.0, sin nuevos SQL ni cambios en Edge Functions.

Instalación: reemplazar el código por el ZIP corregido (incluidos scripts y tests) y volver a desplegar Vercel. No es necesario volver a aplicar el SQL ni redesplegar las funciones por esta corrección.

El fragmento de log recibido no incluía los mensajes completos de las dos aserciones. Se ha corregido la dependencia de las pruebas respecto al checkout y se ha reproducido localmente la ausencia de `.github`; si aparece otro fallo, debe revisarse el mensaje completo de ese nuevo error.

Validación local: 61 pruebas de aplicación, 80 comprobaciones PostgreSQL, lint, validación estructural, preflight y compilación/PWA aprobados.
