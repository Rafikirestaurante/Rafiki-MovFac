# Rafiki MF 1.12.0 — Recuperación de búsquedas que bloquean Push

Copiar supabase y tests sobre el repositorio conservando sus rutas. No requiere SQL, permisos nuevos ni secretos nuevos. El trabajador gmail-push-worker ya recibió esta corrección directamente en Supabase el 15 de octubre de 2026. Incorporar este parche a GitHub para conservarla en los próximos despliegues.

La cola compartida admite una búsqueda pendiente por workspace. Una búsqueda manual de Facturas interrumpida también puede bloquear Movimientos. Se completó la búsqueda #14327 desde el avance 4/22, sin crear nuevas facturas. Después, la búsqueda rápida de Movimientos registró dos movimientos nuevos.

La búsqueda manual #14330 terminó de revisar el rango 9–15 de octubre: 148 correos, dos movimientos adicionales nuevos, 144 ya registrados y dos alertas sin regla; sin errores técnicos. Total de movimientos nuevos recuperados durante la intervención: cuatro. Ninguna búsqueda fue cancelada.

La corrección permite al trabajador Push continuar una búsqueda manual interrumpida cuando su módulo tiene Push activado. Reutiliza el ID, el rango y el progreso originales; no cambia las referencias de la página Push ni adelanta su cursor. Respeta las reservas activas y filtra por workspace y propietario. Si el módulo de la búsqueda pendiente está desactivado, muestra el número de búsqueda y la instrucción concreta para continuarla desde Configuración. No inicia facturas si únicamente se activó Push para movimientos.

No cancela búsquedas, no elimina registros y no toma automáticamente páginas huérfanas de otros trabajos Push. El cierre voluntario y la recuperación manual siguen disponibles.

Validación: 86 pruebas en 21 archivos aprobadas; lint y validación estructural aprobados. Las pruebas nuevas cubren recuperación, reservas activas, selección de módulos, filtros de propietario/workspace, conservación del rango y fallos del procesamiento.
