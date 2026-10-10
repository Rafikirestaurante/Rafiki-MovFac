# Resumen — Rafiki MF 1.2.2 / Fase 2B.2

Se incorporó una vista pública restringida para empleados en `/empleados`. El acceso usa un nombre y una contraseña configurados por el Administrador. Los trabajadores solo pueden ver los últimos cinco movimientos, ejecutar una sincronización limitada de Bancolombia y confirmar la recepción de movimientos de ingreso.

La contraseña se almacena mediante PBKDF2-SHA-256, las sesiones duran ocho horas y se invalidan al cambiar la configuración. La sincronización pública usa un rango fijo de tres días, filtra únicamente el remitente autorizado de Bancolombia y admite una ejecución por minuto. Las confirmaciones guardan trabajador, observación, fecha, hora y auditoría, y actualizan el movimiento como verificado.
