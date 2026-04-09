SET NOCOUNT ON;
GO

IF DB_ID(N'SistemaBancarioDB') IS NULL
BEGIN
    RAISERROR('La base SistemaBancarioDB no existe. Ejecute primero SistemaBancarioCREADOR.sql.', 16, 1);
    RETURN;
END;
GO

USE SistemaBancarioDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------
   Clientes adicionales para pruebas de paneles y CRUD
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.CLIENTE
    WHERE identificador_cliente = '4-7890-1234'
)
BEGIN
    INSERT INTO dbo.CLIENTE (
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
    )
    VALUES (
        '4-7890-1234',
        N'Valeria Chaves Mora',
        N'valeria.chaves@bpv.cr',
        '8822-4411',
        '1994-08-21',
        N'Ingeniera Industrial',
        N'Heredia, San Pablo',
        DATEADD(DAY, -7, SYSDATETIME()),
        'Activo'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CLIENTE
    WHERE identificador_cliente = '9-9999-9999'
)
BEGIN
    INSERT INTO dbo.CLIENTE (
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
    )
    VALUES (
        '9-9999-9999',
        N'Ramon Ibarra Flores',
        N'ramon.ibarra@bpv.cr',
        '8800-9911',
        '1980-12-02',
        N'Comerciante',
        N'Puntarenas, Esparza',
        DATEADD(DAY, -10, SYSDATETIME()),
        'Inactivo'
    );
END;
GO

/* ----------------------------------------------------------
   Cuentas de prueba (activas e inactivas)
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR440044004400440044'
)
BEGIN
    INSERT INTO dbo.CUENTA_BANCARIA (
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
    )
    VALUES (
        'CR440044004400440044',
        N'Cuenta operativa Valeria',
        'CRC',
        350000.00,
        '4-7890-1234',
        DATEADD(DAY, -7, SYSDATETIME()),
        'Activa'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR440044004400440055'
)
BEGIN
    INSERT INTO dbo.CUENTA_BANCARIA (
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
    )
    VALUES (
        'CR440044004400440055',
        N'Ahorro USD Valeria',
        'USD',
        1200.00,
        '4-7890-1234',
        DATEADD(DAY, -7, SYSDATETIME()),
        'Activa'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR990099009900990099'
)
BEGIN
    INSERT INTO dbo.CUENTA_BANCARIA (
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
    )
    VALUES (
        'CR990099009900990099',
        N'Cuenta bloqueada prueba',
        'CRC',
        50000.00,
        '9-9999-9999',
        DATEADD(DAY, -10, SYSDATETIME()),
        'Inactiva'
    );
END;
GO

/* ----------------------------------------------------------
   Transacciones de prueba para vistas y metricas del dia
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-99001'
)
BEGIN
    INSERT INTO dbo.TRANSACCION (
        codigo_transaccion,
        iban,
        identificador_cliente,
        tipo_transaccion,
        descripcion,
        fecha_transaccion,
        monto,
        moneda,
        tipo_cambio_compra,
        tipo_cambio_venta,
        saldo_final,
        codigo_referencia
    )
    VALUES (
        'TRX-99001',
        'CR440044004400440044',
        '4-7890-1234',
        'Deposito',
        N'Deposito inicial de prueba',
        DATEADD(HOUR, -2, SYSDATETIME()),
        350000.00,
        'CRC',
        NULL,
        NULL,
        350000.00,
        NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-99010'
)
BEGIN
    INSERT INTO dbo.TRANSACCION (
        codigo_transaccion,
        iban,
        identificador_cliente,
        tipo_transaccion,
        descripcion,
        fecha_transaccion,
        monto,
        moneda,
        tipo_cambio_compra,
        tipo_cambio_venta,
        saldo_final,
        codigo_referencia
    )
    VALUES (
        'TRX-99010',
        'CR440044004400440055',
        '4-7890-1234',
        'Deposito',
        N'Deposito USD de prueba',
        DATEADD(DAY, -1, SYSDATETIME()),
        1200.00,
        'USD',
        522.0000,
        534.0000,
        1200.00,
        NULL
    );
END;
GO

/* ----------------------------------------------------------
   Solicitud de prestamo de prueba
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.SOLICITUD_PRESTAMO
    WHERE identificador_cliente = '4-7890-1234'
      AND monto_prestamo = 840000.00
      AND plazo_meses = 9
)
BEGIN
    INSERT INTO dbo.SOLICITUD_PRESTAMO (
        fecha_solicitud,
        identificador_cliente,
        monto_prestamo,
        plazo_meses,
        estado
    )
    VALUES (
        DATEADD(DAY, -3, SYSDATETIME()),
        '4-7890-1234',
        840000.00,
        9,
        'Pendiente'
    );
END;
GO

/* ----------------------------------------------------------
   Historial adicional de configuracion
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TIPO_CAMBIO
    WHERE tipo_cambio_compra = 520.5000
      AND tipo_cambio_venta = 532.7500
      AND registrado_por = N'CargaTest'
      AND activo = 0
)
BEGIN
    INSERT INTO dbo.TIPO_CAMBIO (
        moneda_origen,
        moneda_destino,
        tipo_cambio_compra,
        tipo_cambio_venta,
        fecha_modificacion,
        registrado_por,
        activo
    )
    VALUES (
        'USD',
        'CRC',
        520.5000,
        532.7500,
        DATEADD(DAY, -15, SYSDATETIME()),
        N'CargaTest',
        0
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.RANGO_COMISION_RETIRO
    WHERE monto_minimo = 0.00
      AND monto_maximo = 150000.00
      AND porcentaje_comision = 1.25
      AND activo = 0
)
BEGIN
    INSERT INTO dbo.RANGO_COMISION_RETIRO (
        monto_minimo,
        monto_maximo,
        porcentaje_comision,
        fecha_modificacion,
        activo
    )
    VALUES (
        0.00,
        150000.00,
        1.25,
        DATEADD(DAY, -20, SYSDATETIME()),
        0
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.RANGO_COMISION_RETIRO
    WHERE monto_minimo = 150001.00
      AND monto_maximo = 600000.00
      AND porcentaje_comision = 2.75
      AND activo = 0
)
BEGIN
    INSERT INTO dbo.RANGO_COMISION_RETIRO (
        monto_minimo,
        monto_maximo,
        porcentaje_comision,
        fecha_modificacion,
        activo
    )
    VALUES (
        150001.00,
        600000.00,
        2.75,
        DATEADD(DAY, -20, SYSDATETIME()),
        0
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.RANGO_COMISION_RETIRO
    WHERE monto_minimo = 600001.00
      AND monto_maximo = 2000000.00
      AND porcentaje_comision = 4.25
      AND activo = 0
)
BEGIN
    INSERT INTO dbo.RANGO_COMISION_RETIRO (
        monto_minimo,
        monto_maximo,
        porcentaje_comision,
        fecha_modificacion,
        activo
    )
    VALUES (
        600001.00,
        2000000.00,
        4.25,
        DATEADD(DAY, -20, SYSDATETIME()),
        0
    );
END;
GO

/* ----------------------------------------------------------
   Contacto de soporte adicional
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.CONTACTO_SOPORTE
    WHERE correo = N'valeria.chaves@bpv.cr'
      AND asunto = N'Consulta de prestamo'
)
BEGIN
    INSERT INTO dbo.CONTACTO_SOPORTE (
        nombre,
        correo,
        telefono,
        asunto,
        mensaje,
        fecha_contacto,
        estado
    )
    VALUES (
        N'Valeria Chaves',
        N'valeria.chaves@bpv.cr',
        '8822-4411',
        N'Consulta de prestamo',
        N'Requiero confirmar el estado de mi solicitud de prestamo de 9 meses.',
        DATEADD(HOUR, -6, SYSDATETIME()),
        'Pendiente'
    );
END;
GO
