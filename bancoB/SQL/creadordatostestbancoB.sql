SET NOCOUNT ON;
GO

IF DB_ID(N'bancoBDB') IS NULL
BEGIN
    RAISERROR('La base bancoBDB no existe. Ejecute primero bancoBCREADOR.sql.', 16, 1);
    RETURN;
END;
GO

USE bancoBDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------
   Limpieza de datos de prueba previos
   ---------------------------------------------------------- */
DELETE FROM dbo.TRANSACCION_RETIRO
WHERE codigo_transaccion_retiro IN ('TRX-BT1002')
   OR codigo_transaccion_comision IN ('COM-BT1002');

DELETE FROM dbo.TRANSACCION
WHERE codigo_transaccion IN ('TRX-BT1001', 'TRX-BT1002', 'COM-BT1002', 'TRX-BT2001');

DELETE FROM dbo.CUENTA_BANCARIA
WHERE iban IN ('CR4400440044B0440044', 'CR4400440044B0440055', 'CR7700770077B8880002');

DELETE FROM dbo.CLIENTE
WHERE identificador_cliente IN ('4-7890-1234', '4-0000-2222');
GO

/* ----------------------------------------------------------
   Cliente Valeria (4-7890-1234) replicado desde Banco A
   Permite probar el flujo de "traer fondos" B -> A
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
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR4400440044B0440044'
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
        'CR4400440044B0440044',
        N'Cuenta operativa Valeria',
        'CRC',
        0.00,
        '4-7890-1234',
        DATEADD(DAY, -7, SYSDATETIME()),
        'Activa'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR4400440044B0440055'
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
        'CR4400440044B0440055',
        N'Ahorro USD Valeria',
        'USD',
        0.00,
        '4-7890-1234',
        DATEADD(DAY, -7, SYSDATETIME()),
        'Activa'
    );
END;
GO

/* ----------------------------------------------------------
   Cliente y cuenta inactivos para pruebas de validacion
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.CLIENTE
    WHERE identificador_cliente = '4-0000-2222'
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
        '4-0000-2222',
        N'Miguel Rojas Cerdas',
        N'miguel.rojas@bancob.cr',
        '8511-2211',
        '1988-06-03',
        N'Consultor',
        N'San Jose, Escazu',
        '2026-04-01T09:00:00',
        'Inactivo'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR7700770077B8880002'
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
        'CR7700770077B8880002',
        N'Cuenta prueba inactiva',
        'CRC',
        48000.00,
        '4-0000-2222',
        '2026-04-01T09:05:00',
        'Inactiva'
    );
END;
GO

/* ----------------------------------------------------------
   Historial de prueba: cuenta CRC de Laura
   Saldo final esperado en cuenta: 850000.00
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-BT1001'
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
        'TRX-BT1001',
        'CR0501230000B5678901',
        '1-0456-1234',
        'Deposito',
        N'Deposito de prueba inicial',
        '2026-04-02T09:15:00',
        900750.00,
        'CRC',
        NULL,
        NULL,
        900750.00,
        NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-BT1002'
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
        'TRX-BT1002',
        'CR0501230000B5678901',
        '1-0456-1234',
        'Retiro',
        N'Retiro de prueba con comision',
        '2026-04-04T11:20:00',
        50000.00,
        'CRC',
        NULL,
        NULL,
        850750.00,
        NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'COM-BT1002'
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
        'COM-BT1002',
        'CR0501230000B5678901',
        '1-0456-1234',
        'Comision',
        N'Comision aplicada al retiro de prueba',
        '2026-04-04T11:21:00',
        750.00,
        'CRC',
        NULL,
        NULL,
        850000.00,
        'TRX-BT1002'
    );
END;
GO

DECLARE @idRangoComisionLaura INT;

SELECT TOP 1 @idRangoComisionLaura = id_rango_comision
FROM dbo.RANGO_COMISION_RETIRO
WHERE activo = 1
  AND 50000.00 BETWEEN monto_minimo AND monto_maximo
ORDER BY id_rango_comision ASC;

IF @idRangoComisionLaura IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.TRANSACCION_RETIRO
       WHERE codigo_transaccion_retiro = 'TRX-BT1002'
   )
BEGIN
    INSERT INTO dbo.TRANSACCION_RETIRO (
        codigo_transaccion_retiro,
        id_rango_comision,
        porcentaje_comision_aplicado,
        monto_comision,
        saldo_despues_retiro,
        codigo_transaccion_comision
    )
    VALUES (
        'TRX-BT1002',
        @idRangoComisionLaura,
        1.50,
        750.00,
        850750.00,
        'COM-BT1002'
    );
END;
GO

/* ----------------------------------------------------------
   Movimiento USD de prueba para historial de cuenta
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-BT2001'
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
        'TRX-BT2001',
        'CR3300200030B0400050',
        '2-1234-5678',
        'Transferencia',
        N'Ingreso USD de prueba',
        DATEADD(HOUR, -1, SYSDATETIME()),
        1200.00,
        'USD',
        522.0000,
        534.0000,
        1200.00,
        NULL
    );
END;
GO
