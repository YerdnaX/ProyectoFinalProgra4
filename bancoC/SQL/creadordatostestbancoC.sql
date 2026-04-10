SET NOCOUNT ON;
GO

IF DB_ID(N'bancoCDB') IS NULL
BEGIN
    RAISERROR('La base bancoCDB no existe. Ejecute primero bancoCCreador.sql.', 16, 1);
    RETURN;
END;
GO

USE bancoCDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------
   Limpieza de datos de prueba previos
   ---------------------------------------------------------- */
DELETE FROM dbo.TRANSACCION_RETIRO
WHERE codigo_transaccion_retiro IN ('TRX-CT1002')
   OR codigo_transaccion_comision IN ('COM-CT1002');

DELETE FROM dbo.TRANSACCION
WHERE codigo_transaccion IN ('TRX-CT1001', 'TRX-CT1002', 'COM-CT1002', 'TRX-CT2001');

DELETE FROM dbo.CUENTA_BANCARIA
WHERE iban IN ('CR4400440044C0440044', 'CR4400440044C0440055', 'CR8800880088C9990003');

DELETE FROM dbo.CLIENTE
WHERE identificador_cliente IN ('4-7890-1234', '7-3333-4444');
GO

/* ----------------------------------------------------------
   Cliente Valeria (4-7890-1234) replicado desde Banco A
   Permite probar el flujo de "traer fondos" C -> A
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
    WHERE iban = 'CR4400440044C0440044'
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
        'CR4400440044C0440044',
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
    WHERE iban = 'CR4400440044C0440055'
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
        'CR4400440044C0440055',
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
    WHERE identificador_cliente = '7-3333-4444'
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
        '7-3333-4444',
        N'Elena Pineda Arias',
        N'elena.pineda@bancoc.cr',
        '8622-9090',
        '1991-02-14',
        N'Psicologa',
        N'Cartago, Tres Rios',
        '2026-04-01T08:40:00',
        'Inactivo'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.CUENTA_BANCARIA
    WHERE iban = 'CR8800880088C9990003'
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
        'CR8800880088C9990003',
        N'Cuenta prueba inactiva',
        'CRC',
        15000.00,
        '7-3333-4444',
        '2026-04-01T08:45:00',
        'Inactiva'
    );
END;
GO

/* ----------------------------------------------------------
   Historial de prueba: cuenta CRC de Ana
   Saldo final esperado en cuenta: 410000.00
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-CT1001'
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
        'TRX-CT1001',
        'CR9900110022C3344550',
        '5-5555-0001',
        'Deposito',
        N'Deposito de prueba inicial',
        '2026-04-03T10:30:00',
        450600.00,
        'CRC',
        NULL,
        NULL,
        450600.00,
        NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-CT1002'
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
        'TRX-CT1002',
        'CR9900110022C3344550',
        '5-5555-0001',
        'Retiro',
        N'Retiro de prueba con comision',
        '2026-04-05T14:15:00',
        40000.00,
        'CRC',
        NULL,
        NULL,
        410600.00,
        NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'COM-CT1002'
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
        'COM-CT1002',
        'CR9900110022C3344550',
        '5-5555-0001',
        'Comision',
        N'Comision aplicada al retiro de prueba',
        '2026-04-05T14:16:00',
        600.00,
        'CRC',
        NULL,
        NULL,
        410000.00,
        'TRX-CT1002'
    );
END;
GO

DECLARE @idRangoComisionAna INT;

SELECT TOP 1 @idRangoComisionAna = id_rango_comision
FROM dbo.RANGO_COMISION_RETIRO
WHERE activo = 1
  AND 40000.00 BETWEEN monto_minimo AND monto_maximo
ORDER BY id_rango_comision ASC;

IF @idRangoComisionAna IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.TRANSACCION_RETIRO
       WHERE codigo_transaccion_retiro = 'TRX-CT1002'
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
        'TRX-CT1002',
        @idRangoComisionAna,
        1.50,
        600.00,
        410600.00,
        'COM-CT1002'
    );
END;
GO

/* ----------------------------------------------------------
   Movimiento USD de prueba para historial de cuenta
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.TRANSACCION
    WHERE codigo_transaccion = 'TRX-CT2001'
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
        'TRX-CT2001',
        'CR3300200030C0400050',
        '2-1234-5678',
        'Transferencia',
        N'Ingreso USD de prueba',
        DATEADD(HOUR, -3, SYSDATETIME()),
        950.00,
        'USD',
        522.0000,
        534.0000,
        950.00,
        NULL
    );
END;
GO
