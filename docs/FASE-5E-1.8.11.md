# Fase 5E — 1.8.11: diagnóstico visible

Base: ZIP local fase5-ab-aislado/1.8.10-rafiki-mf-fase5d-diagnostico.zip. La ruta H: proporcionada no permitió lectura; no se ha confirmado igualdad de archivos con Google Drive.

Hallazgo: 1.8.10 incluye SyncDiagnostic en Movimientos, dentro de Opciones. Ambos paneles están cerrados inicialmente. No hay condición por rol para mostrar el componente. La ausencia de workspace_sync_diagnostic provoca error al consultar, no oculta el panel.

Cambio: diagnóstico fuera de Opciones, directamente debajo del encabezado y avisos de Movimientos. Se mantiene plegable y consulta únicamente al pulsar Actualizar diagnóstico. Identificación 1.8.11 / Fase 5E.

Verificación: compilación de producción con dependencias locales existentes. No se verificó aplicación publicada, OAuth, base de datos ni sincronización real. Sin despliegues ni migraciones.

En la app publicada: comprobar versión en Configuración. En 1.8.10, abrir Movimientos → Opciones → Diagnóstico avanzado de sincronización. Si falta, comparar versión desplegada y actualizar la aplicación/PWA. La caché o un despliegue anterior son hipótesis pendientes de comprobar.

Pendientes de fase 5E: confirmar unicidad de movimientos dentro del workspace; auditar aislamiento y permisos; validar respuesta al navegador, lotes y concurrencia; comprobar recuperación de movimientos recientes. Esta entrega no declara resuelta la sincronización.
