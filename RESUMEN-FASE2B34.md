# Resumen — Fase 2B.3.4

Versión 1.2.7. Se reemplaza el selector de 2, 6 y 12 horas por un único botón **Búsqueda rápida** en Movimientos, Configuración y `/empleados`. La Edge Function consulta exclusivamente las alertas de Bancolombia recibidas durante la última hora exacta y procesa como máximo las 20 más recientes. La regla se aplica en backend y no puede ampliarse desde el navegador. Se conserva la búsqueda histórica por fechas para administradores y el límite público de una sincronización por minuto. No requiere SQL nuevo.
