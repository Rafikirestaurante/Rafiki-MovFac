# Rafiki MF 1.12.0 — Modos exclusivos de sincronización

Copiar las carpetas src, tests y supabase de este parche sobre el repositorio 1.12.0, conservando sus rutas. Subir los cambios a GitHub para que Vercel despliegue la interfaz. No requiere migraciones SQL ni nuevos secretos o permisos.

- Push activo para Movimientos suspende sus consultas periódicas de Gmail. El indicador muestra Push y Configurar, sin selector de intervalos.
- Los intervalos 10, 30 y 60 segundos se conservan. Al desactivar Push se recuperan el intervalo y la preferencia de activación anteriores.
- Facturas se controla de forma independiente: solo suspende su modo periódico si se selecciona también para Push.
- Al cargar la sesión se comprueba el estado del servidor antes de programar consultas de Gmail. Durante una activación/desactivación o ante una respuesta incierta se suspende el modo periódico hasta confirmar el estado.
- La aplicación vuelve a comprobar el modo al recuperar el foco y cada minuto. Esto consulta la configuración, no busca correos. Los cambios hechos desde otro dispositivo se reflejan en la siguiente comprobación.
- Una petición de sincronización que ya empezó puede terminar; se cancelan los temporizadores y no se programan nuevas peticiones periódicas para el módulo en Push. Las búsquedas manuales siguen disponibles.
- Incluye la corrección anterior de historyId numérico seguro, ya desplegada en el receptor, para que futuros despliegues la conserven.

Validación local: 81 pruebas en 20 archivos aprobadas, lint, validación estructural y compilación aprobados. La interfaz de este parche aún debe desplegarse. No se cambió la configuración Push ya instalada en producción.
