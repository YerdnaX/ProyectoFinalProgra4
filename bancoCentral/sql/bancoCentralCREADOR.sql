--  Banco Central - Sistema Bancario V2
--  Nodo principal de coordinacion interbancaria

SET NOCOUNT ON;
GO

IF DB_ID(N'bancoCentralDB') IS NULL
BEGIN
    CREATE DATABASE bancoCentralDB;
END;
GO

USE bancoCentralDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ==========================================================
   Limpieza para ejecucion repetible del script
   ========================================================== */
IF OBJECT_ID(N'dbo.HISTORIAL_INTERBANCARIO', N'U') IS NOT NULL
    DROP TABLE dbo.HISTORIAL_INTERBANCARIO;
GO
IF OBJECT_ID(N'dbo.ENRUTAMIENTO', N'U') IS NOT NULL
    DROP TABLE dbo.ENRUTAMIENTO;
GO
IF OBJECT_ID(N'dbo.BANCO_REGISTRADO', N'U') IS NOT NULL
    DROP TABLE dbo.BANCO_REGISTRADO;
GO

/* ==========================================================
   TABLA: BANCO_REGISTRADO
   Catalogo de bancos del ecosistema.
   ========================================================== */
CREATE TABLE dbo.BANCO_REGISTRADO (
    codigo_banco VARCHAR(10) NOT NULL,
    nombre_banco NVARCHAR(100) NOT NULL,
    url_base VARCHAR(200) NOT NULL,
    puerto INT NOT NULL,
    activo BIT NOT NULL
        CONSTRAINT DF_BC_BANCO_ACTIVO DEFAULT (1),
    fecha_registro DATETIME2(0) NOT NULL
        CONSTRAINT DF_BC_BANCO_FECHA DEFAULT SYSDATETIME(),
    CONSTRAINT PK_BC_BANCO_REGISTRADO PRIMARY KEY (codigo_banco),
    CONSTRAINT CK_BC_BANCO_PUERTO CHECK (puerto > 0 AND puerto <= 65535)
);
GO

/* ==========================================================
   TABLA: ENRUTAMIENTO
   Tabla de enrutamiento: mapea cliente/telefono/cuenta → banco.
   Un IBAN pertenece exactamente a un banco.
   ========================================================== */
CREATE TABLE dbo.ENRUTAMIENTO (
    id_enrutamiento INT IDENTITY(1,1) NOT NULL,
    identificador_cliente VARCHAR(20) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    iban VARCHAR(34) NOT NULL,
    codigo_banco VARCHAR(10) NOT NULL,
    moneda CHAR(3) NOT NULL,
    activo BIT NOT NULL
        CONSTRAINT DF_BC_ENRUT_ACTIVO DEFAULT (1),
    fecha_registro DATETIME2(0) NOT NULL
        CONSTRAINT DF_BC_ENRUT_FECHA DEFAULT SYSDATETIME(),
    CONSTRAINT PK_BC_ENRUTAMIENTO PRIMARY KEY (id_enrutamiento),
    CONSTRAINT UQ_BC_ENRUT_IBAN UNIQUE (iban),
    CONSTRAINT FK_BC_ENRUT_BANCO
        FOREIGN KEY (codigo_banco)
        REFERENCES dbo.BANCO_REGISTRADO (codigo_banco),
    CONSTRAINT CK_BC_ENRUT_MONEDA CHECK (moneda IN ('CRC', 'USD'))
);
GO

CREATE INDEX IX_BC_ENRUT_TELEFONO
    ON dbo.ENRUTAMIENTO (telefono)
    WHERE activo = 1;
GO

CREATE INDEX IX_BC_ENRUT_CLIENTE
    ON dbo.ENRUTAMIENTO (identificador_cliente)
    WHERE activo = 1;
GO

/* ==========================================================
   TABLA: HISTORIAL_INTERBANCARIO
   Registro inmutable de todas las operaciones interbancarias.
   Los registros no pueden ser modificados ni eliminados.
   ========================================================== */
CREATE TABLE dbo.HISTORIAL_INTERBANCARIO (
    id_historial BIGINT IDENTITY(1,1) NOT NULL,
    codigo_operacion VARCHAR(30) NOT NULL,
    tipo_operacion VARCHAR(30) NOT NULL,
    banco_origen VARCHAR(10) NULL,
    banco_destino VARCHAR(10) NOT NULL,
    iban_origen VARCHAR(34) NULL,
    iban_destino VARCHAR(34) NOT NULL,
    identificador_cliente_origen VARCHAR(20) NULL,
    identificador_cliente_destino VARCHAR(20) NOT NULL,
    monto DECIMAL(18,2) NOT NULL,
    moneda CHAR(3) NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    descripcion NVARCHAR(250) NULL,
    detalle_error NVARCHAR(500) NULL,
    fecha_operacion DATETIME2(0) NOT NULL
        CONSTRAINT DF_BC_HIST_FECHA DEFAULT SYSDATETIME(),
    CONSTRAINT PK_BC_HISTORIAL PRIMARY KEY (id_historial),
    CONSTRAINT UQ_BC_HIST_CODIGO UNIQUE (codigo_operacion),
    CONSTRAINT CK_BC_HIST_TIPO CHECK (tipo_operacion IN (
        'TransferenciaTelefono',
        'TransferenciaCuenta',
        'PagoRestaurante',
        'DepositoDistribuido',
        'RetiroDistribuido'
    )),
    CONSTRAINT CK_BC_HIST_MONEDA CHECK (moneda IN ('CRC', 'USD')),
    CONSTRAINT CK_BC_HIST_MONTO CHECK (monto > 0),
    CONSTRAINT CK_BC_HIST_RESULTADO CHECK (resultado IN ('Exitosa', 'Fallida'))
);
GO

/* ==========================================================
   Datos iniciales: bancos del ecosistema
   ========================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.BANCO_REGISTRADO)
BEGIN
    INSERT INTO dbo.BANCO_REGISTRADO (codigo_banco, nombre_banco, url_base, puerto, activo)
    VALUES
        ('A', N'Pura Vida Banco',  'http://localhost', 3001, 1),
        ('B', N'Banco B',          'http://localhost', 3003, 1),
        ('C', N'Banco C',          'http://localhost', 3004, 1);
END;
GO

/* ==========================================================
   Datos iniciales: enrutamiento de cuentas de prueba
   Mapea cuentas seed de bancoB y bancoC con su telefono
   ========================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.ENRUTAMIENTO)
BEGIN
    -- Cuentas del Banco B
    INSERT INTO dbo.ENRUTAMIENTO (identificador_cliente, telefono, iban, codigo_banco, moneda)
    VALUES
        ('1-0456-1234', '8888-1200', 'CR0501230000B5678901', 'B', 'CRC'),
        ('P-99332211',  '8630-2209', 'CR1155001020B3405060', 'B', 'CRC'),
        ('2-1234-5678', '8777-9080', 'CR3300200030B0400050', 'B', 'USD');

    -- Cuentas del Banco C
    INSERT INTO dbo.ENRUTAMIENTO (identificador_cliente, telefono, iban, codigo_banco, moneda)
    VALUES
        ('1-0456-1234', '8888-1200', 'CR0501230000C5678901', 'C', 'CRC'),
        ('2-1234-5678', '8777-9080', 'CR3300200030C0400050', 'C', 'USD'),
        ('5-5555-0001', '8500-3311', 'CR9900110022C3344550', 'C', 'CRC');

    -- Cuentas del Banco A (puraviabanco)
    INSERT INTO dbo.ENRUTAMIENTO (identificador_cliente, telefono, iban, codigo_banco, moneda)
    VALUES
        ('1-0456-1234', '8888-1200', 'CR050123000045678901', 'A', 'CRC'),
        ('1-0456-1234', '8888-1200', 'CR870001002003004005', 'A', 'USD'),
        ('P-99332211',  '8630-2209', 'CR115500102030405060', 'A', 'CRC'),
        ('2-1234-5678', '8777-9080', 'CR330020003000400050', 'A', 'CRC');
END;
GO
