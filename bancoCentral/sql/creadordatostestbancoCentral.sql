SET NOCOUNT ON;
GO

IF DB_ID(N'bancoCentralDB') IS NULL
BEGIN
    RAISERROR('La base bancoCentralDB no existe. Ejecute primero bancoCentralCREADOR.sql.', 16, 1);
    RETURN;
END;
GO

USE bancoCentralDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------
   Limpieza de datos de prueba previos
   ---------------------------------------------------------- */
DELETE FROM dbo.HISTORIAL_INTERBANCARIO;
GO

DELETE FROM dbo.ENRUTAMIENTO;
GO

/* ----------------------------------------------------------
   Enrutamiento adicional de prueba
   Agrega cuentas que existen en los datos de bancos A/B/C.
   ---------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR239876543210987654')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '800123456789',
        '7090-4433',
        'CR239876543210987654',
        'A',
        'USD',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR440044004400440044')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR440044004400440044',
        'A',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR440044004400440055')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR440044004400440055',
        'A',
        'USD',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR990099009900990099')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '9-9999-9999',
        '8800-9911',
        'CR990099009900990099',
        'A',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR7700770077B8880002')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-0000-2222',
        '8511-2211',
        'CR7700770077B8880002',
        'B',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR8800880088C9990003')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '7-3333-4444',
        '8622-9090',
        'CR8800880088C9990003',
        'C',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

/* ----------------------------------------------------------
   Enrutamiento de cuentas de Valeria (4-7890-1234) en Banco B y Banco C
   Corresponde a las cuentas creadas en creadordatostestbancoB.sql y bancoC.sql
   Permite probar el flujo completo de "traer fondos" B->A y C->A para Valeria
   ---------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR4400440044B0440044')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR4400440044B0440044',
        'B',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR4400440044B0440055')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR4400440044B0440055',
        'B',
        'USD',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR4400440044C0440044')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR4400440044C0440044',
        'C',
        'CRC',
        1,
        SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO WHERE iban = 'CR4400440044C0440055')
BEGIN
    INSERT INTO dbo.ENRUTAMIENTO (
        identificador_cliente,
        telefono,
        iban,
        codigo_banco,
        moneda,
        activo,
        fecha_registro
    )
    VALUES (
        '4-7890-1234',
        '8822-4411',
        'CR4400440044C0440055',
        'C',
        'USD',
        1,
        SYSDATETIME()
    );
END;
GO

/* ----------------------------------------------------------
   Historial interbancario de prueba
   Cubre operaciones exitosas y fallidas usadas por el API.
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-TEL-000001'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-TEL-000001',
        'TransferenciaTelefono',
        'A',
        'B',
        'CR050123000045678901',
        'CR1155001020B3405060',
        '1-0456-1234',
        'P-99332211',
        25000.00,
        'CRC',
        'Exitosa',
        N'Transferencia por telefono de prueba',
        NULL,
        '2026-04-06T09:40:00'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-TEL-000002'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-TEL-000002',
        'TransferenciaTelefono',
        'A',
        'C',
        'CR115500102030405060',
        'CR9900110022C3344550',
        'P-99332211',
        '5-5555-0001',
        50000.00,
        'CRC',
        'Fallida',
        N'Transferencia por telefono de prueba',
        N'Saldo insuficiente en la cuenta origen.',
        '2026-04-06T10:05:00'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-CTA-000001'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-CTA-000001',
        'TransferenciaCuenta',
        'B',
        'A',
        'CR0501230000B5678901',
        'CR050123000045678901',
        '1-0456-1234',
        '1-0456-1234',
        85000.00,
        'CRC',
        'Exitosa',
        N'Transferencia por cuenta hacia Banco A',
        NULL,
        '2026-04-07T11:25:00'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-CTA-000002'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-CTA-000002',
        'TransferenciaCuenta',
        'C',
        'A',
        'CR3300200030C0400050',
        'CR330020003000400050',
        '2-1234-5678',
        '2-1234-5678',
        300.00,
        'USD',
        'Fallida',
        N'Transferencia por cuenta hacia Banco A',
        N'Las cuentas no operan en la misma moneda.',
        '2026-04-07T12:10:00'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-PAG-000001'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-PAG-000001',
        'PagoRestaurante',
        'A',
        'A',
        'CR330020003000400050',
        'CR330020003000400050',
        '2-1234-5678',
        '2-1234-5678',
        15250.00,
        'CRC',
        'Exitosa',
        N'Pago restaurante de prueba',
        NULL,
        DATEADD(MINUTE, -45, SYSDATETIME())
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-PAG-000002'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-PAG-000002',
        'PagoRestaurante',
        'B',
        'B',
        'CR3300200030B0400050',
        'CR3300200030B0400050',
        '2-1234-5678',
        '2-1234-5678',
        2500.00,
        'USD',
        'Fallida',
        N'Pago restaurante de prueba',
        N'Saldo insuficiente en la cuenta del cliente.',
        DATEADD(MINUTE, -30, SYSDATETIME())
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-DD-000001'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-DD-000001',
        'DepositoDistribuido',
        NULL,
        'A',
        NULL,
        'CR115500102030405060',
        NULL,
        'P-99332211',
        40000.00,
        'CRC',
        'Exitosa',
        N'Deposito distribuido de prueba',
        NULL,
        '2026-04-08T08:50:00'
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.HISTORIAL_INTERBANCARIO
    WHERE codigo_operacion = 'OP-RD-000001'
)
BEGIN
    INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion,
        tipo_operacion,
        banco_origen,
        banco_destino,
        iban_origen,
        iban_destino,
        identificador_cliente_origen,
        identificador_cliente_destino,
        monto,
        moneda,
        resultado,
        descripcion,
        detalle_error,
        fecha_operacion
    )
    VALUES (
        'OP-RD-000001',
        'RetiroDistribuido',
        'C',
        'C',
        'CR9900110022C3344550',
        'CR9900110022C3344550',
        '5-5555-0001',
        '5-5555-0001',
        10000.00,
        'CRC',
        'Exitosa',
        N'Retiro distribuido de prueba',
        NULL,
        '2026-04-08T09:15:00'
    );
END;
GO
