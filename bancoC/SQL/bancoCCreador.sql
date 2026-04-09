--  Banco C - Sistema Bancario V2

SET NOCOUNT ON;
GO

IF DB_ID(N'bancoCDB') IS NULL
BEGIN
    CREATE DATABASE bancoCDB;
END;
GO

USE bancoCDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ==========================================================
   Limpieza para ejecucion repetible del script
   ========================================================== */
IF OBJECT_ID(N'dbo.TRANSACCION_RETIRO', N'U') IS NOT NULL
    DROP TABLE dbo.TRANSACCION_RETIRO;
GO
IF OBJECT_ID(N'dbo.TRANSACCION', N'U') IS NOT NULL
    DROP TABLE dbo.TRANSACCION;
GO
IF OBJECT_ID(N'dbo.CUENTA_BANCARIA', N'U') IS NOT NULL
    DROP TABLE dbo.CUENTA_BANCARIA;
GO
IF OBJECT_ID(N'dbo.CLIENTE', N'U') IS NOT NULL
    DROP TABLE dbo.CLIENTE;
GO
IF OBJECT_ID(N'dbo.TIPO_CAMBIO', N'U') IS NOT NULL
    DROP TABLE dbo.TIPO_CAMBIO;
GO
IF OBJECT_ID(N'dbo.RANGO_COMISION_RETIRO', N'U') IS NOT NULL
    DROP TABLE dbo.RANGO_COMISION_RETIRO;
GO

/* ==========================================================
   TABLA: CLIENTE
   ========================================================== */
CREATE TABLE dbo.CLIENTE (
    identificador_cliente VARCHAR(20) NOT NULL,
    nombre_completo NVARCHAR(150) NOT NULL,
    correo_electronico NVARCHAR(120) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    ocupacion NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(250) NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_C_CLIENTE_FECHA_CREACION DEFAULT SYSDATETIME(),
    estado VARCHAR(10) NOT NULL,
    CONSTRAINT PK_C_CLIENTE PRIMARY KEY (identificador_cliente),
    CONSTRAINT UQ_C_CLIENTE_CORREO UNIQUE (correo_electronico),
    CONSTRAINT CK_C_CLIENTE_ESTADO CHECK (estado IN ('Activo', 'Inactivo'))
);
GO

/* ==========================================================
   TABLA: CUENTA_BANCARIA
   ========================================================== */
CREATE TABLE dbo.CUENTA_BANCARIA (
    iban VARCHAR(34) NOT NULL,
    alias_cuenta NVARCHAR(100) NOT NULL,
    moneda CHAR(3) NOT NULL,
    saldo_actual DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_C_CUENTA_SALDO DEFAULT (0),
    identificador_cliente VARCHAR(20) NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_C_CUENTA_FECHA_CREACION DEFAULT SYSDATETIME(),
    estado VARCHAR(10) NOT NULL,
    CONSTRAINT PK_C_CUENTA_BANCARIA PRIMARY KEY (iban),
    CONSTRAINT UQ_C_CUENTA_IBAN_CLIENTE UNIQUE (iban, identificador_cliente),
    CONSTRAINT FK_C_CUENTA_CLIENTE
        FOREIGN KEY (identificador_cliente)
        REFERENCES dbo.CLIENTE (identificador_cliente),
    CONSTRAINT CK_C_CUENTA_MONEDA CHECK (moneda IN ('CRC', 'USD')),
    CONSTRAINT CK_C_CUENTA_SALDO CHECK (saldo_actual >= 0),
    CONSTRAINT CK_C_CUENTA_ESTADO CHECK (estado IN ('Activa', 'Inactiva'))
);
GO

/* ==========================================================
   TABLA: TIPO_CAMBIO
   ========================================================== */
CREATE TABLE dbo.TIPO_CAMBIO (
    id_tipo_cambio INT IDENTITY(1,1) NOT NULL,
    moneda_origen CHAR(3) NOT NULL
        CONSTRAINT DF_C_TIPO_CAMBIO_MONEDA_ORIGEN DEFAULT ('USD'),
    moneda_destino CHAR(3) NOT NULL
        CONSTRAINT DF_C_TIPO_CAMBIO_MONEDA_DESTINO DEFAULT ('CRC'),
    tipo_cambio_compra DECIMAL(12,4) NOT NULL,
    tipo_cambio_venta DECIMAL(12,4) NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_C_TIPO_CAMBIO_FECHA DEFAULT SYSDATETIME(),
    registrado_por NVARCHAR(120) NOT NULL,
    activo BIT NOT NULL
        CONSTRAINT DF_C_TIPO_CAMBIO_ACTIVO DEFAULT (1),
    CONSTRAINT PK_C_TIPO_CAMBIO PRIMARY KEY (id_tipo_cambio),
    CONSTRAINT CK_C_TIPO_CAMBIO_MONEDA_ORIGEN CHECK (moneda_origen IN ('CRC', 'USD')),
    CONSTRAINT CK_C_TIPO_CAMBIO_MONEDA_DESTINO CHECK (moneda_destino IN ('CRC', 'USD')),
    CONSTRAINT CK_C_TIPO_CAMBIO_MONEDAS_DISTINTAS CHECK (moneda_origen <> moneda_destino),
    CONSTRAINT CK_C_TIPO_CAMBIO_COMPRA CHECK (tipo_cambio_compra > 0),
    CONSTRAINT CK_C_TIPO_CAMBIO_VENTA CHECK (tipo_cambio_venta > 0)
);
GO

CREATE UNIQUE INDEX UX_C_TIPO_CAMBIO_ACTIVO
    ON dbo.TIPO_CAMBIO (moneda_origen, moneda_destino)
    WHERE activo = 1;
GO

/* ==========================================================
   TABLA: RANGO_COMISION_RETIRO
   ========================================================== */
CREATE TABLE dbo.RANGO_COMISION_RETIRO (
    id_rango_comision INT IDENTITY(1,1) NOT NULL,
    monto_minimo DECIMAL(18,2) NOT NULL,
    monto_maximo DECIMAL(18,2) NOT NULL,
    porcentaje_comision DECIMAL(5,2) NOT NULL,
    fecha_modificacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_C_RANGO_COMISION_FECHA DEFAULT SYSDATETIME(),
    activo BIT NOT NULL
        CONSTRAINT DF_C_RANGO_COMISION_ACTIVO DEFAULT (1),
    CONSTRAINT PK_C_RANGO_COMISION_RETIRO PRIMARY KEY (id_rango_comision),
    CONSTRAINT CK_C_RANGO_COMISION_MINIMO CHECK (monto_minimo >= 0),
    CONSTRAINT CK_C_RANGO_COMISION_MAXIMO CHECK (monto_maximo >= monto_minimo),
    CONSTRAINT CK_C_RANGO_COMISION_PORCENTAJE CHECK (
        porcentaje_comision > 0 AND porcentaje_comision <= 100
    )
);
GO

/* ==========================================================
   TABLA: TRANSACCION
   Incluye 'Transferencia' ademas de los tipos de la V1.
   ========================================================== */
CREATE TABLE dbo.TRANSACCION (
    codigo_transaccion VARCHAR(20) NOT NULL,
    iban VARCHAR(34) NOT NULL,
    identificador_cliente VARCHAR(20) NOT NULL,
    tipo_transaccion VARCHAR(15) NOT NULL,
    descripcion NVARCHAR(250) NOT NULL,
    fecha_transaccion DATETIME2(0) NOT NULL
        CONSTRAINT DF_C_TRANSACCION_FECHA DEFAULT SYSDATETIME(),
    monto DECIMAL(18,2) NOT NULL,
    moneda CHAR(3) NOT NULL,
    tipo_cambio_compra DECIMAL(12,4) NULL,
    tipo_cambio_venta DECIMAL(12,4) NULL,
    saldo_final DECIMAL(18,2) NOT NULL,
    codigo_referencia VARCHAR(20) NULL,
    CONSTRAINT PK_C_TRANSACCION PRIMARY KEY (codigo_transaccion),
    CONSTRAINT FK_C_TRANSACCION_CUENTA_CLIENTE
        FOREIGN KEY (iban, identificador_cliente)
        REFERENCES dbo.CUENTA_BANCARIA (iban, identificador_cliente),
    CONSTRAINT FK_C_TRANSACCION_REFERENCIA
        FOREIGN KEY (codigo_referencia)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT CK_C_TRANSACCION_TIPO CHECK (tipo_transaccion IN ('Deposito', 'Retiro', 'Comision', 'Transferencia')),
    CONSTRAINT CK_C_TRANSACCION_MONEDA CHECK (moneda IN ('CRC', 'USD')),
    CONSTRAINT CK_C_TRANSACCION_MONTO CHECK (monto > 0),
    CONSTRAINT CK_C_TRANSACCION_SALDO_FINAL CHECK (saldo_final >= 0),
    CONSTRAINT CK_C_TRANSACCION_TC_COMPRA CHECK (tipo_cambio_compra IS NULL OR tipo_cambio_compra > 0),
    CONSTRAINT CK_C_TRANSACCION_TC_VENTA CHECK (tipo_cambio_venta IS NULL OR tipo_cambio_venta > 0),
    CONSTRAINT CK_C_TRANSACCION_TC_CRC CHECK (
        (moneda = 'CRC' AND tipo_cambio_compra IS NULL AND tipo_cambio_venta IS NULL)
        OR moneda = 'USD'
    )
);
GO

/* ==========================================================
   TABLA: TRANSACCION_RETIRO
   Guarda detalle de comision aplicada a cada retiro.
   ========================================================== */
CREATE TABLE dbo.TRANSACCION_RETIRO (
    codigo_transaccion_retiro VARCHAR(20) NOT NULL,
    id_rango_comision INT NOT NULL,
    porcentaje_comision_aplicado DECIMAL(5,2) NOT NULL,
    monto_comision DECIMAL(18,2) NOT NULL,
    saldo_despues_retiro DECIMAL(18,2) NOT NULL,
    codigo_transaccion_comision VARCHAR(20) NULL,
    CONSTRAINT PK_C_TRANSACCION_RETIRO PRIMARY KEY (codigo_transaccion_retiro),
    CONSTRAINT UQ_C_TRANSACCION_RETIRO_COMISION UNIQUE (codigo_transaccion_comision),
    CONSTRAINT FK_C_TRANSACCION_RETIRO_TRANSACCION
        FOREIGN KEY (codigo_transaccion_retiro)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT FK_C_TRANSACCION_RETIRO_RANGO
        FOREIGN KEY (id_rango_comision)
        REFERENCES dbo.RANGO_COMISION_RETIRO (id_rango_comision),
    CONSTRAINT FK_C_TRANSACCION_RETIRO_COMISION
        FOREIGN KEY (codigo_transaccion_comision)
        REFERENCES dbo.TRANSACCION (codigo_transaccion),
    CONSTRAINT CK_C_TRANSACCION_RETIRO_PORCENTAJE CHECK (
        porcentaje_comision_aplicado > 0 AND porcentaje_comision_aplicado <= 100
    ),
    CONSTRAINT CK_C_TRANSACCION_RETIRO_MONTO_COMISION CHECK (monto_comision >= 0),
    CONSTRAINT CK_C_TRANSACCION_RETIRO_SALDO CHECK (saldo_despues_retiro >= 0)
);
GO

/* ==========================================================
   Datos iniciales
   ========================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.CLIENTE)
BEGIN
    INSERT INTO dbo.CLIENTE (
        identificador_cliente, nombre_completo, correo_electronico,
        telefono, fecha_nacimiento, ocupacion, direccion, fecha_creacion, estado
    )
    VALUES
        ('1-0456-1234', N'Laura Fernandez Rojas', N'laura.fernandez@bancoc.cr', '8888-1200', '1992-04-12', N'Arquitecta',    N'San Jose, Montes de Oca', '2026-03-18T10:34:00', 'Activo'),
        ('2-1234-5678', N'Carlos Mendez Soto',     N'carlos.mendez@bancoc.cr',  '8777-9080', '1990-11-30', N'Contador',      N'Alajuela, Grecia',        '2026-03-12T11:10:00', 'Activo'),
        ('5-5555-0001', N'Ana Rodriguez Vega',     N'ana.rodriguez@bancoc.cr',  '8500-3311', '1995-07-18', N'Ingeniera',     N'Heredia, Belen',          '2026-04-01T08:00:00', 'Activo');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CUENTA_BANCARIA)
BEGIN
    INSERT INTO dbo.CUENTA_BANCARIA (
        iban, alias_cuenta, moneda, saldo_actual,
        identificador_cliente, fecha_creacion, estado
    )
    VALUES
        ('CR0501230000C5678901', N'Cuenta Banco C Laura',  'CRC', 600000.00, '1-0456-1234', '2026-03-18T10:34:00', 'Activa'),
        ('CR3300200030C0400050', N'Cuenta Banco C Carlos', 'USD', 950.00,    '2-1234-5678', '2026-03-12T11:15:00', 'Activa'),
        ('CR9900110022C3344550', N'Cuenta Banco C Ana',    'CRC', 410000.00, '5-5555-0001', '2026-04-01T08:05:00', 'Activa');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TIPO_CAMBIO)
BEGIN
    INSERT INTO dbo.TIPO_CAMBIO (
        moneda_origen, moneda_destino,
        tipo_cambio_compra, tipo_cambio_venta,
        fecha_modificacion, registrado_por, activo
    )
    VALUES ('USD', 'CRC', 522.0000, 534.0000, SYSDATETIME(), N'Admin', 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.RANGO_COMISION_RETIRO)
BEGIN
    INSERT INTO dbo.RANGO_COMISION_RETIRO (
        monto_minimo, monto_maximo, porcentaje_comision, fecha_modificacion, activo
    )
    VALUES
        (0.00,       100000.00,  1.50, SYSDATETIME(), 1),
        (100001.00,  500000.00,  3.00, SYSDATETIME(), 1),
        (500001.00, 2000000.00,  4.50, SYSDATETIME(), 1);
END;
GO
