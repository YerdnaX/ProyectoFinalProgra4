var express = require('express');
var router = express.Router();
var database = require('./database');

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarMoneda(valor) {
  return valor === 'USD' ? 'USD' : 'CRC';
}

function redondearDosDecimales(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/* ----------------------------------------------------------
   GET /api/status
   Health check del servicio
   ---------------------------------------------------------- */
router.get('/status', function (req, res) {
  return res.json({ ok: true, banco: 'C', mensaje: 'Banco C operativo' });
});

/* ----------------------------------------------------------
   GET /api/clientes
   Lista completa de clientes con todos sus detalles y cuentas
   ---------------------------------------------------------- */
router.get('/clientes', async function (req, res) {
  try {
    const pool = await database.poolPromise;

    const clientesResult = await pool.request().query(`
      SELECT
        identificador_cliente,
        nombre_completo,
        correo_electronico,
        telefono,
        fecha_nacimiento,
        ocupacion,
        direccion,
        fecha_creacion,
        estado
      FROM dbo.CLIENTE
      ORDER BY fecha_creacion DESC, identificador_cliente ASC;
    `);

    const cuentasResult = await pool.request().query(`
      SELECT
        iban,
        alias_cuenta,
        moneda,
        saldo_actual,
        identificador_cliente,
        fecha_creacion,
        estado
      FROM dbo.CUENTA_BANCARIA
      ORDER BY fecha_creacion DESC, iban ASC;
    `);

    const cuentasPorCliente = (cuentasResult.recordset || []).reduce(function (acc, cuenta) {
      const key = cuenta.identificador_cliente;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(cuenta);
      return acc;
    }, {});

    const data = (clientesResult.recordset || []).map(function (cliente) {
      return Object.assign({}, cliente, {
        cuentas: cuentasPorCliente[cliente.identificador_cliente] || []
      });
    });

    return res.json({ ok: true, data: data });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando clientes.' });
  }
});

/* ----------------------------------------------------------
   GET /api/clientes/:id
   Consulta un cliente por identificador
   ---------------------------------------------------------- */
router.get('/clientes/:id', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const id = normalizarTexto(req.params.id);

    if (!id) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'Identificador requerido.' });
    }

    const result = await pool
      .request()
      .input('id', database.sql.VarChar(20), id)
      .query(`
        SELECT identificador_cliente, nombre_completo, telefono, estado
        FROM dbo.CLIENTE
        WHERE identificador_cliente = @id;
      `);

    const cliente = result.recordset[0] || null;
    if (!cliente) {
      return res.status(404).json({ ok: false, reason: 'NOT_FOUND', message: 'Cliente no encontrado.' });
    }

    return res.json({ ok: true, data: cliente });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando cliente.' });
  }
});

/* ----------------------------------------------------------
   GET /api/cuentas
   Lista completa de cuentas del banco con detalle de cliente
   ---------------------------------------------------------- */
router.get('/cuentas', async function (req, res) {
  try {
    const pool = await database.poolPromise;

    const result = await pool.request().query(`
      SELECT
        cb.iban,
        cb.alias_cuenta,
        cb.moneda,
        cb.saldo_actual,
        cb.identificador_cliente,
        cb.fecha_creacion,
        cb.estado AS estado_cuenta,
        c.nombre_completo,
        c.correo_electronico,
        c.telefono,
        c.estado AS estado_cliente
      FROM dbo.CUENTA_BANCARIA cb
      INNER JOIN dbo.CLIENTE c
        ON c.identificador_cliente = cb.identificador_cliente
      ORDER BY cb.fecha_creacion DESC, cb.iban ASC;
    `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando cuentas.' });
  }
});

/* ----------------------------------------------------------
   GET /api/cuentas/:iban
   Consulta una cuenta por IBAN
   ---------------------------------------------------------- */
router.get('/cuentas/:iban', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.params.iban).toUpperCase();

    if (!iban) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'IBAN requerido.' });
    }

    const result = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT
          cb.iban,
          cb.alias_cuenta,
          cb.moneda,
          cb.saldo_actual,
          cb.identificador_cliente,
          cb.estado AS estado_cuenta,
          c.nombre_completo,
          c.telefono,
          c.estado AS estado_cliente
        FROM dbo.CUENTA_BANCARIA cb
        INNER JOIN dbo.CLIENTE c
          ON c.identificador_cliente = cb.identificador_cliente
        WHERE cb.iban = @iban;
      `);

    const cuenta = result.recordset[0] || null;
    if (!cuenta) {
      return res.status(404).json({ ok: false, reason: 'NOT_FOUND', message: 'Cuenta no encontrada.' });
    }

    return res.json({ ok: true, data: cuenta });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando cuenta.' });
  }
});

/* ----------------------------------------------------------
   GET /api/cuentas/por-cliente/:clienteId
   Lista cuentas de un cliente
   ---------------------------------------------------------- */
router.get('/cuentas/por-cliente/:clienteId', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const clienteId = normalizarTexto(req.params.clienteId);

    if (!clienteId) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'ID de cliente requerido.' });
    }

    const result = await pool
      .request()
      .input('clienteId', database.sql.VarChar(20), clienteId)
      .query(`
        SELECT
          cb.iban,
          cb.alias_cuenta,
          cb.moneda,
          cb.saldo_actual,
          cb.identificador_cliente,
          cb.estado
        FROM dbo.CUENTA_BANCARIA cb
        WHERE cb.identificador_cliente = @clienteId
        ORDER BY cb.fecha_creacion DESC;
      `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando cuentas.' });
  }
});

/* ----------------------------------------------------------
   POST /api/cuentas/crear
   Crea una nueva cuenta bancaria (para creacion distribuida)
   Body: { iban, aliasCuenta, moneda, saldoActual, identificadorCliente }
   ---------------------------------------------------------- */
router.post('/cuentas/crear', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.body.iban).toUpperCase();
    const aliasCuenta = normalizarTexto(req.body.aliasCuenta);
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const saldoActual = Number(req.body.saldoActual || 0);
    const identificadorCliente = normalizarTexto(req.body.identificadorCliente);

    if (!iban || !aliasCuenta || !identificadorCliente) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'IBAN, alias y cliente son obligatorios.'
      });
    }

    if (!Number.isFinite(saldoActual) || saldoActual < 0) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_BALANCE',
        message: 'El saldo debe ser mayor o igual a cero.'
      });
    }

    // Verificar que el cliente exista
    const clienteResult = await pool
      .request()
      .input('clienteId', database.sql.VarChar(20), identificadorCliente)
      .query(`SELECT identificador_cliente FROM dbo.CLIENTE WHERE identificador_cliente = @clienteId;`);

    if (clienteResult.recordset.length === 0) {
      return res.status(404).json({
        ok: false,
        reason: 'CLIENT_NOT_FOUND',
        message: 'El cliente no existe en este banco.'
      });
    }

    // Verificar si la cuenta ya existe
    const existeResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`SELECT COUNT(*) AS total FROM dbo.CUENTA_BANCARIA WHERE iban = @iban;`);

    if (Number(existeResult.recordset[0].total) > 0) {
      return res.status(409).json({
        ok: false,
        reason: 'ALREADY_EXISTS',
        message: 'La cuenta ya existe en este banco.'
      });
    }

    await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .input('aliasCuenta', database.sql.NVarChar(100), aliasCuenta)
      .input('moneda', database.sql.Char(3), moneda)
      .input('saldoActual', database.sql.Decimal(18, 2), saldoActual)
      .input('identificadorCliente', database.sql.VarChar(20), identificadorCliente)
      .query(`
        INSERT INTO dbo.CUENTA_BANCARIA (
          iban, alias_cuenta, moneda, saldo_actual,
          identificador_cliente, fecha_creacion, estado
        )
        VALUES (
          @iban, @aliasCuenta, @moneda, @saldoActual,
          @identificadorCliente, SYSDATETIME(), 'Activa'
        );
      `);

    return res.json({ ok: true, message: 'Cuenta creada correctamente en Banco C.', iban: iban });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error creando cuenta.' });
  }
});

/* ----------------------------------------------------------
   POST /api/transacciones/deposito
   Registra un deposito en una cuenta
   Body: { iban, monto, moneda, descripcion }
   ---------------------------------------------------------- */
router.post('/transacciones/deposito', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.body.iban).toUpperCase();
    const descripcion = normalizarTexto(req.body.descripcion) || 'Deposito';
    const montoTexto = normalizarTexto(req.body.monto);
    const monedaDeposito = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const tipoTransaccion = normalizarTexto(req.body.tipoTransaccion) || 'Deposito';
    const tipoPermitido = ['Deposito', 'Transferencia'].includes(tipoTransaccion) ? tipoTransaccion : 'Deposito';

    if (!iban || !montoTexto) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'IBAN y monto son obligatorios.' });
    }

    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ ok: false, reason: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const cuentaResult = await new database.sql.Request(tx)
        .input('iban', database.sql.VarChar(34), iban)
        .query(`
          SELECT
            cb.iban, cb.moneda, cb.saldo_actual, cb.identificador_cliente,
            cb.estado AS estado_cuenta, c.estado AS estado_cliente
          FROM dbo.CUENTA_BANCARIA cb
          INNER JOIN dbo.CLIENTE c ON c.identificador_cliente = cb.identificador_cliente
          WHERE cb.iban = @iban;
        `);

      const cuenta = cuentaResult.recordset[0] || null;
      if (!cuenta) {
        await tx.rollback();
        return res.status(404).json({ ok: false, reason: 'ACCOUNT_NOT_FOUND', message: 'Cuenta no encontrada.' });
      }

      if (cuenta.estado_cuenta !== 'Activa' || cuenta.estado_cliente !== 'Activo') {
        await tx.rollback();
        return res.status(409).json({ ok: false, reason: 'ACCOUNT_INACTIVE', message: 'Cuenta o cliente inactivo.' });
      }

      let montoAcreditado = monto;
      let tipoCambioCompra = null;
      let tipoCambioVenta = null;

      if (monedaDeposito !== cuenta.moneda) {
        const tcResult = await new database.sql.Request(tx).query(`
          SELECT TOP 1 tipo_cambio_compra, tipo_cambio_venta
          FROM dbo.TIPO_CAMBIO
          WHERE activo = 1 AND moneda_origen = 'USD' AND moneda_destino = 'CRC'
          ORDER BY fecha_modificacion DESC;
        `);

        const tc = tcResult.recordset[0] || null;
        if (!tc) {
          await tx.rollback();
          return res.status(409).json({ ok: false, reason: 'EXCHANGE_RATE_NOT_FOUND', message: 'Tipo de cambio no encontrado.' });
        }

        const compra = Number(tc.tipo_cambio_compra);
        const venta = Number(tc.tipo_cambio_venta);
        tipoCambioCompra = compra;
        tipoCambioVenta = venta;

        if (monedaDeposito === 'USD' && cuenta.moneda === 'CRC') {
          montoAcreditado = monto * compra;
        } else if (monedaDeposito === 'CRC' && cuenta.moneda === 'USD') {
          montoAcreditado = monto / venta;
        }
      }

      montoAcreditado = redondearDosDecimales(montoAcreditado);
      const saldoFinal = redondearDosDecimales(Number(cuenta.saldo_actual) + montoAcreditado);

      const codigoResult = await new database.sql.Request(tx).query(
        `SELECT 'TRX-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigo;`
      );
      const codigoTransaccion = codigoResult.recordset[0].codigo;

      await new database.sql.Request(tx)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`UPDATE dbo.CUENTA_BANCARIA SET saldo_actual = @saldoFinal WHERE iban = @iban;`);

      await new database.sql.Request(tx)
        .input('codigo', database.sql.VarChar(20), codigoTransaccion)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('cliente', database.sql.VarChar(20), cuenta.identificador_cliente)
        .input('tipo', database.sql.VarChar(15), tipoPermitido)
        .input('descripcion', database.sql.NVarChar(250), descripcion)
        .input('monto', database.sql.Decimal(18, 2), montoAcreditado)
        .input('moneda', database.sql.Char(3), cuenta.moneda)
        .input('tcCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
        .input('tcVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`
          INSERT INTO dbo.TRANSACCION (
            codigo_transaccion, iban, identificador_cliente, tipo_transaccion,
            descripcion, fecha_transaccion, monto, moneda,
            tipo_cambio_compra, tipo_cambio_venta, saldo_final, codigo_referencia
          ) VALUES (
            @codigo, @iban, @cliente, @tipo,
            @descripcion, SYSDATETIME(), @monto, @moneda,
            @tcCompra, @tcVenta, @saldoFinal, NULL
          );
        `);

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Deposito registrado en Banco C.',
        data: {
          codigoTransaccion: codigoTransaccion,
          iban: cuenta.iban,
          montoAcreditado: montoAcreditado,
          saldoFinal: saldoFinal
        }
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error registrando deposito.' });
  }
});

/* ----------------------------------------------------------
   POST /api/transacciones/retiro
   Registra un retiro con o sin comision.
   Body: { iban, monto, moneda, descripcion, sinComision? }
   sinComision = true se usa para transferencias req#17 (sin comision)
   ---------------------------------------------------------- */
router.post('/transacciones/retiro', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.body.iban).toUpperCase();
    const descripcion = normalizarTexto(req.body.descripcion) || 'Retiro';
    const montoTexto = normalizarTexto(req.body.monto);
    const monedaRetiro = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const sinComision = req.body.sinComision === true || req.body.sinComision === 'true';
    const tipoTransaccion = normalizarTexto(req.body.tipoTransaccion) || 'Retiro';
    const tipoPermitido = ['Retiro', 'Transferencia'].includes(tipoTransaccion) ? tipoTransaccion : 'Retiro';

    if (!iban || !montoTexto) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'IBAN y monto son obligatorios.' });
    }

    const montoIngresado = Number(montoTexto);
    if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) {
      return res.status(400).json({ ok: false, reason: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' });
    }

    const tx = new database.sql.Transaction(pool);
    await tx.begin();

    try {
      const cuentaResult = await new database.sql.Request(tx)
        .input('iban', database.sql.VarChar(34), iban)
        .query(`
          SELECT
            cb.iban, cb.moneda, cb.saldo_actual, cb.identificador_cliente,
            cb.estado AS estado_cuenta, c.estado AS estado_cliente
          FROM dbo.CUENTA_BANCARIA cb
          INNER JOIN dbo.CLIENTE c ON c.identificador_cliente = cb.identificador_cliente
          WHERE cb.iban = @iban;
        `);

      const cuenta = cuentaResult.recordset[0] || null;
      if (!cuenta) {
        await tx.rollback();
        return res.status(404).json({ ok: false, reason: 'ACCOUNT_NOT_FOUND', message: 'Cuenta no encontrada.' });
      }

      if (cuenta.estado_cuenta !== 'Activa' || cuenta.estado_cliente !== 'Activo') {
        await tx.rollback();
        return res.status(409).json({ ok: false, reason: 'ACCOUNT_INACTIVE', message: 'Cuenta o cliente inactivo.' });
      }

      const tcResult = await new database.sql.Request(tx).query(`
        SELECT TOP 1 tipo_cambio_compra, tipo_cambio_venta
        FROM dbo.TIPO_CAMBIO
        WHERE activo = 1 AND moneda_origen = 'USD' AND moneda_destino = 'CRC'
        ORDER BY fecha_modificacion DESC;
      `);

      const tc = tcResult.recordset[0] || null;
      const compra = Number((tc || {}).tipo_cambio_compra || 0);
      const venta = Number((tc || {}).tipo_cambio_venta || 0);

      let montoRetiro = montoIngresado;
      let tipoCambioCompra = null;
      let tipoCambioVenta = null;

      if (monedaRetiro !== cuenta.moneda) {
        if (!tc || compra <= 0 || venta <= 0) {
          await tx.rollback();
          return res.status(409).json({ ok: false, reason: 'EXCHANGE_RATE_NOT_FOUND', message: 'Tipo de cambio no encontrado.' });
        }

        if (monedaRetiro === 'USD' && cuenta.moneda === 'CRC') {
          montoRetiro = montoIngresado * compra;
          tipoCambioCompra = compra;
          tipoCambioVenta = venta;
        } else if (monedaRetiro === 'CRC' && cuenta.moneda === 'USD') {
          montoRetiro = montoIngresado / venta;
          tipoCambioCompra = compra;
          tipoCambioVenta = venta;
        }
      }

      montoRetiro = redondearDosDecimales(montoRetiro);

      let montoComision = 0;
      let idRangoComision = null;
      let porcentajeComision = 0;

      if (!sinComision) {
        // Calcular base en CRC para determinar rango de comision
        let montoBaseComisionCRC = montoRetiro;
        if (cuenta.moneda === 'USD') {
          if (!tc || compra <= 0) {
            await tx.rollback();
            return res.status(409).json({ ok: false, reason: 'EXCHANGE_RATE_NOT_FOUND', message: 'Tipo de cambio no disponible para calcular comisión.' });
          }
          montoBaseComisionCRC = montoRetiro * compra;
        }
        montoBaseComisionCRC = redondearDosDecimales(montoBaseComisionCRC);

        const rangoResult = await new database.sql.Request(tx)
          .input('montoBase', database.sql.Decimal(18, 2), montoBaseComisionCRC)
          .query(`
            SELECT TOP 1 id_rango_comision, porcentaje_comision
            FROM dbo.RANGO_COMISION_RETIRO
            WHERE activo = 1 AND @montoBase BETWEEN monto_minimo AND monto_maximo
            ORDER BY id_rango_comision ASC;
          `);

        const rango = rangoResult.recordset[0] || null;
        if (!rango) {
          await tx.rollback();
          return res.status(409).json({ ok: false, reason: 'COMMISSION_RANGE_NOT_FOUND', message: 'No existe rango de comisión para este monto.' });
        }

        idRangoComision = rango.id_rango_comision;
        porcentajeComision = Number(rango.porcentaje_comision);
        montoComision = redondearDosDecimales(montoRetiro * (porcentajeComision / 100));
      }

      const saldoActual = Number(cuenta.saldo_actual);
      const totalDescontar = redondearDosDecimales(montoRetiro + montoComision);

      if (saldoActual < totalDescontar) {
        await tx.rollback();
        return res.status(409).json({ ok: false, reason: 'INSUFFICIENT_FUNDS', message: 'Saldo insuficiente.' });
      }

      const saldoDespuesRetiro = redondearDosDecimales(saldoActual - montoRetiro);
      const saldoFinal = redondearDosDecimales(saldoDespuesRetiro - montoComision);

      const codigoRetiroResult = await new database.sql.Request(tx).query(
        `SELECT 'TRX-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigo;`
      );
      const codigoRetiro = codigoRetiroResult.recordset[0].codigo;

      await new database.sql.Request(tx)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
        .query(`UPDATE dbo.CUENTA_BANCARIA SET saldo_actual = @saldoFinal WHERE iban = @iban;`);

      const saldoTrasRetiro = sinComision ? saldoFinal : saldoDespuesRetiro;

      await new database.sql.Request(tx)
        .input('codigo', database.sql.VarChar(20), codigoRetiro)
        .input('iban', database.sql.VarChar(34), cuenta.iban)
        .input('cliente', database.sql.VarChar(20), cuenta.identificador_cliente)
        .input('tipo', database.sql.VarChar(15), tipoPermitido)
        .input('descripcion', database.sql.NVarChar(250), descripcion)
        .input('monto', database.sql.Decimal(18, 2), montoRetiro)
        .input('moneda', database.sql.Char(3), cuenta.moneda)
        .input('tcCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
        .input('tcVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
        .input('saldoTrasRetiro', database.sql.Decimal(18, 2), saldoTrasRetiro)
        .query(`
          INSERT INTO dbo.TRANSACCION (
            codigo_transaccion, iban, identificador_cliente, tipo_transaccion,
            descripcion, fecha_transaccion, monto, moneda,
            tipo_cambio_compra, tipo_cambio_venta, saldo_final, codigo_referencia
          ) VALUES (
            @codigo, @iban, @cliente, @tipo,
            @descripcion, SYSDATETIME(), @monto, @moneda,
            @tcCompra, @tcVenta, @saldoTrasRetiro, NULL
          );
        `);

      if (!sinComision && montoComision > 0) {
        const codigoComisionResult = await new database.sql.Request(tx).query(
          `SELECT 'COM-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 15) AS codigo;`
        );
        const codigoComision = codigoComisionResult.recordset[0].codigo;

        await new database.sql.Request(tx)
          .input('codigo', database.sql.VarChar(20), codigoComision)
          .input('iban', database.sql.VarChar(34), cuenta.iban)
          .input('cliente', database.sql.VarChar(20), cuenta.identificador_cliente)
          .input('monto', database.sql.Decimal(18, 2), montoComision)
          .input('moneda', database.sql.Char(3), cuenta.moneda)
          .input('tcCompra', database.sql.Decimal(12, 4), tipoCambioCompra)
          .input('tcVenta', database.sql.Decimal(12, 4), tipoCambioVenta)
          .input('saldoFinal', database.sql.Decimal(18, 2), saldoFinal)
          .input('codigoRetiro', database.sql.VarChar(20), codigoRetiro)
          .query(`
            INSERT INTO dbo.TRANSACCION (
              codigo_transaccion, iban, identificador_cliente, tipo_transaccion,
              descripcion, fecha_transaccion, monto, moneda,
              tipo_cambio_compra, tipo_cambio_venta, saldo_final, codigo_referencia
            ) VALUES (
              @codigo, @iban, @cliente, 'Comision',
              N'Comisión por retiro', SYSDATETIME(), @monto, @moneda,
              @tcCompra, @tcVenta, @saldoFinal, @codigoRetiro
            );
          `);

        await new database.sql.Request(tx)
          .input('codigoRetiro', database.sql.VarChar(20), codigoRetiro)
          .input('idRango', database.sql.Int, idRangoComision)
          .input('porcentaje', database.sql.Decimal(5, 2), porcentajeComision)
          .input('montoComision', database.sql.Decimal(18, 2), montoComision)
          .input('saldoDespues', database.sql.Decimal(18, 2), saldoDespuesRetiro)
          .input('codigoComision', database.sql.VarChar(20), codigoComision)
          .query(`
            INSERT INTO dbo.TRANSACCION_RETIRO (
              codigo_transaccion_retiro, id_rango_comision,
              porcentaje_comision_aplicado, monto_comision,
              saldo_despues_retiro, codigo_transaccion_comision
            ) VALUES (
              @codigoRetiro, @idRango,
              @porcentaje, @montoComision,
              @saldoDespues, @codigoComision
            );
          `);
      }

      await tx.commit();

      return res.json({
        ok: true,
        message: 'Retiro registrado en Banco C.',
        data: {
          codigoTransaccion: codigoRetiro,
          iban: cuenta.iban,
          montoRetirado: montoRetiro,
          montoComision: montoComision,
          saldoFinal: saldoFinal
        }
      });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error registrando retiro.' });
  }
});

/* ----------------------------------------------------------
   GET /api/transacciones/por-cuenta/:iban
   Historial de transacciones de una cuenta
   ---------------------------------------------------------- */
router.get('/transacciones/por-cuenta/:iban', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarTexto(req.params.iban).toUpperCase();

    if (!iban) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'IBAN requerido.' });
    }

    const result = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT TOP 100
          codigo_transaccion,
          tipo_transaccion,
          descripcion,
          fecha_transaccion,
          monto,
          moneda,
          saldo_final,
          codigo_referencia
        FROM dbo.TRANSACCION
        WHERE iban = @iban
        ORDER BY fecha_transaccion DESC, codigo_transaccion DESC;
      `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando transacciones.' });
  }
});

module.exports = router;
