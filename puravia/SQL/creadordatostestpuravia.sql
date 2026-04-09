SET NOCOUNT ON;
GO

IF DB_ID(N'puravia') IS NULL
BEGIN
    RAISERROR('La base puravia no existe. Ejecute primero el script base del proyecto.', 16, 1);
    RETURN;
END;
GO

USE puravia;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------
   Usuarios de prueba para panel admin
   ---------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE username = 'soporte1')
BEGIN
    INSERT INTO dbo.usuario (
        nombre,
        correo,
        username,
        password_hash,
        rol,
        estado,
        notas
    )
    VALUES (
        'Soporte Operativo',
        'soporte@puravia.cr',
        'soporte1',
        'soporte1_hash',
        'admin',
        'Activo',
        'Usuario adicional para pruebas administrativas'
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE username = 'mcampos')
BEGIN
    INSERT INTO dbo.usuario (
        nombre,
        correo,
        username,
        password_hash,
        rol,
        estado,
        notas
    )
    VALUES (
        'Mariela Campos',
        'mariela@puravia.cr',
        'mcampos',
        'mcampos_hash',
        'mesero',
        'Activo',
        'Mesera creada para pruebas de ordenes'
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE username = 'rprado')
BEGIN
    INSERT INTO dbo.usuario (
        nombre,
        correo,
        username,
        password_hash,
        rol,
        estado,
        notas
    )
    VALUES (
        'Ricardo Prado',
        'ricardo@puravia.cr',
        'rprado',
        'rprado_hash',
        'mesero',
        'Suspendido',
        'Usuario en estado suspendido para pruebas'
    );
END;
GO

/* ----------------------------------------------------------
   Meseros adicionales
   ---------------------------------------------------------- */
DECLARE @usuarioCamposId INT = (
    SELECT TOP 1 id
    FROM dbo.usuario
    WHERE username = 'mcampos'
);

IF @usuarioCamposId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.mesero WHERE identificacion = '4-5678-9012')
BEGIN
    INSERT INTO dbo.mesero (
        nombre,
        identificacion,
        telefono,
        correo,
        turno,
        usuario_id,
        observaciones,
        fecha_ingreso
    )
    VALUES (
        'Mariela Campos',
        '4-5678-9012',
        '8787-0010',
        'mariela@puravia.cr',
        'Tarde',
        @usuarioCamposId,
        'Especialista en atencion de grupos',
        '2026-03-20'
    );
END;
GO

DECLARE @usuarioPradoId INT = (
    SELECT TOP 1 id
    FROM dbo.usuario
    WHERE username = 'rprado'
);

IF @usuarioPradoId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.mesero WHERE identificacion = '5-6789-0123')
BEGIN
    INSERT INTO dbo.mesero (
        nombre,
        identificacion,
        telefono,
        correo,
        turno,
        usuario_id,
        observaciones,
        fecha_ingreso
    )
    VALUES (
        'Ricardo Prado',
        '5-6789-0123',
        '8787-0020',
        'ricardo@puravia.cr',
        'Noche',
        @usuarioPradoId,
        'Cobertura de fines de semana',
        '2026-03-25'
    );
END;
GO

/* ----------------------------------------------------------
   Mesas y productos adicionales
   ---------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.mesa WHERE numero = 13)
BEGIN
    INSERT INTO dbo.mesa (numero, capacidad, estado, ubicacion, nota)
    VALUES (13, 6, 'libre', 'Terraza', 'Mesa para grupos pequenos');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.mesa WHERE numero = 14)
BEGIN
    INSERT INTO dbo.mesa (numero, capacidad, estado, ubicacion, nota)
    VALUES (14, 2, 'libre', 'Interior', 'Ideal para cenas privadas');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.producto WHERE nombre = 'Hamburguesa PuraVia')
BEGIN
    INSERT INTO dbo.producto (nombre, descripcion, categoria, precio, activo)
    VALUES ('Hamburguesa PuraVia', 'Carne artesanal con pan brioche y papas rusticas', 'Platos fuertes', 6900.00, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.producto WHERE nombre = 'Limonada Hierbabuena')
BEGIN
    INSERT INTO dbo.producto (nombre, descripcion, categoria, precio, activo)
    VALUES ('Limonada Hierbabuena', 'Bebida natural con hierbabuena fresca', 'Bebidas', 2200.00, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.producto WHERE nombre = 'Tres Leches Tradicional')
BEGIN
    INSERT INTO dbo.producto (nombre, descripcion, categoria, precio, activo)
    VALUES ('Tres Leches Tradicional', 'Postre casero de la casa', 'Postres', 3900.00, 1);
END;
GO

/* ----------------------------------------------------------
   Orden cerrada de prueba y su detalle
   ---------------------------------------------------------- */
DECLARE @mesa13Id INT = (
    SELECT TOP 1 id
    FROM dbo.mesa
    WHERE numero = 13
);
DECLARE @meseroCamposId INT = (
    SELECT TOP 1 id
    FROM dbo.mesero
    WHERE identificacion = '4-5678-9012'
);
DECLARE @productoHambId INT = (
    SELECT TOP 1 id
    FROM dbo.producto
    WHERE nombre = 'Hamburguesa PuraVia'
);
DECLARE @productoLimonadaId INT = (
    SELECT TOP 1 id
    FROM dbo.producto
    WHERE nombre = 'Limonada Hierbabuena'
);
DECLARE @ordenCerradaPruebaId INT = NULL;

IF @mesa13Id IS NOT NULL AND @meseroCamposId IS NOT NULL
BEGIN
    SELECT TOP 1 @ordenCerradaPruebaId = id
    FROM dbo.orden
    WHERE mesa_id = @mesa13Id
      AND estado = 'cerrada'
      AND total = 20566.00
    ORDER BY id DESC;

    IF @ordenCerradaPruebaId IS NULL
    BEGIN
        INSERT INTO dbo.orden (
            mesa_id,
            mesero_id,
            estado,
            total,
            creada_en,
            cerrada_en
        )
        VALUES (
            @mesa13Id,
            @meseroCamposId,
            'cerrada',
            20566.00,
            DATEADD(DAY, -1, DATEADD(HOUR, -3, SYSDATETIME())),
            DATEADD(DAY, -1, DATEADD(HOUR, -2, SYSDATETIME()))
        );

        SET @ordenCerradaPruebaId = SCOPE_IDENTITY();
    END;
END;

IF @ordenCerradaPruebaId IS NOT NULL AND @productoHambId IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.orden_detalle
       WHERE orden_id = @ordenCerradaPruebaId
         AND producto_id = @productoHambId
   )
BEGIN
    INSERT INTO dbo.orden_detalle (
        orden_id,
        producto_id,
        cantidad,
        precio_unit,
        observaciones
    )
    VALUES (
        @ordenCerradaPruebaId,
        @productoHambId,
        2,
        6900.00,
        'Coccion tres cuartos'
    );
END;

IF @ordenCerradaPruebaId IS NOT NULL AND @productoLimonadaId IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.orden_detalle
       WHERE orden_id = @ordenCerradaPruebaId
         AND producto_id = @productoLimonadaId
   )
BEGIN
    INSERT INTO dbo.orden_detalle (
        orden_id,
        producto_id,
        cantidad,
        precio_unit,
        observaciones
    )
    VALUES (
        @ordenCerradaPruebaId,
        @productoLimonadaId,
        2,
        2200.00,
        'Sin azucar'
    );
END;
GO

/* ----------------------------------------------------------
   Reservas adicionales para pruebas de agenda
   ---------------------------------------------------------- */
DECLARE @mesa13Id INT = (
    SELECT TOP 1 id
    FROM dbo.mesa
    WHERE numero = 13
);
DECLARE @mesa14Id INT = (
    SELECT TOP 1 id
    FROM dbo.mesa
    WHERE numero = 14
);
DECLARE @fechaReservaConfirmada DATETIME2(0) = DATEADD(
    HOUR,
    19,
    CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS DATE)) AS DATETIME2(0))
);
DECLARE @fechaReservaPendiente DATETIME2(0) = DATEADD(
    HOUR,
    20,
    CAST(DATEADD(DAY, 2, CAST(SYSDATETIME() AS DATE)) AS DATETIME2(0))
);

IF @mesa14Id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.reserva
       WHERE mesa_id = @mesa14Id
         AND cliente_nombre = 'Daniel Rojas'
         AND fecha_hora = @fechaReservaConfirmada
   )
BEGIN
    INSERT INTO dbo.reserva (
        mesa_id,
        cliente_nombre,
        cliente_telefono,
        fecha_hora,
        cantidad_personas,
        estado,
        nota
    )
    VALUES (
        @mesa14Id,
        'Daniel Rojas',
        '8855-1020',
        @fechaReservaConfirmada,
        4,
        'confirmada',
        'Celebracion familiar'
    );
END;

IF @mesa13Id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM dbo.reserva
       WHERE mesa_id = @mesa13Id
         AND cliente_nombre = 'Sonia Ulate'
         AND fecha_hora = @fechaReservaPendiente
   )
BEGIN
    INSERT INTO dbo.reserva (
        mesa_id,
        cliente_nombre,
        cliente_telefono,
        fecha_hora,
        cantidad_personas,
        estado,
        nota
    )
    VALUES (
        @mesa13Id,
        'Sonia Ulate',
        '8877-3399',
        @fechaReservaPendiente,
        6,
        'pendiente',
        'Posible evento de empresa'
    );
END;
GO

/* ----------------------------------------------------------
   Mensajes de contacto para pruebas de formulario
   ---------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.contacto
    WHERE correo = 'eventos@empresa-cr.com'
      AND asunto = 'Reserva corporativa abril'
)
BEGIN
    INSERT INTO dbo.contacto (
        nombre,
        correo,
        telefono,
        asunto,
        mensaje
    )
    VALUES (
        'Paula Nunez',
        'eventos@empresa-cr.com',
        '8844-7788',
        'Reserva corporativa abril',
        'Solicito cotizacion para grupo de 18 personas el proximo mes.'
    );
END;
GO
