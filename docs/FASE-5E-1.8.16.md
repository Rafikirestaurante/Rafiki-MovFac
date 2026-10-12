# 1.8.16 — Nequi Bre-B y selección de bancos

Nequi: remitente exacto notificaciones@nequi.com.co. Regla de ingreso Recibiste plata por Bre-B / Recibiste 1.500 de NOMBRE el 12 de octubre de 2026 a las 2:49 p.m, desde el banco Bancolombia. Resultado validado: income, 1500 COP, nombre del remitente, 2026-10-12T19:49:00Z, banco de origen en metadata. Formatos desconocidos quedan para revisión en el calendario (Alertas bancarias no reconocidas).

Movimientos → Opciones → Bancos para sincronizar: Bancolombia, Nequi o ambos. No permite selección vacía. Valor inicial Bancolombia para conservar comportamiento previo. Preferencia local por ID de usuario en este navegador, sin persistencia entre dispositivos. Se aplica al servicio compartido de búsquedas por horas, fechas, sincronización automática y verificador Gmail. No filtra ni borra movimientos anteriores, ni modifica sincronización de facturas.

El backend valida los bancos solicitados, limita la consulta Gmail a esos remitentes y ejecuta únicamente el extractor correspondiente al remitente. Las fechas siguen aplicándose a la consulta. Se mantiene el filtro por workspace y el banco entra en la huella de duplicados. Las estadísticas con nombres bancolombia_emails y bancolombia_unidentified se conservan como campos de compatibilidad y en esta versión contabilizan las alertas de bancos seleccionados.

Publicación: redesplegar gmail-sync-now y gmail-diagnostics, incluyendo todos los archivos _shared (banks.ts, nequi.ts, bancolombia.ts). Publicar web 1.8.16. No requiere nueva migración: esquema base ya admite source nequi. No se hicieron despliegues ni cambios en producción.

Validación: 31 pruebas aprobadas y compilación completa. Incluye ejemplo Nequi, búsqueda por banco, selección inválida, preferencias separadas por usuario y regresiones anteriores. Sin prueba de Gmail real ni runtime Edge.

Validación tras publicar: seleccionar Nequi, buscar fecha 12/10/2026 y comprobar ingreso de 1500 COP; repetir para verificar que no duplica. Seleccionar solo Bancolombia para comprobar que no procesa Nequi. La preferencia cambia solicitudes futuras; no cancela una ejecución ya iniciada.
