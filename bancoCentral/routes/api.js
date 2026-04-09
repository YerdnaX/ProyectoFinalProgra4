var express = require('express');
var router = express.Router();
var axios = require('axios');
var database = require('./database');

// ============================================================
// Helpers internos
// ============================================================

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarMoneda(valor) {
  return valor === 'USD' ? 'USD' : 'CRC';
}

function redondearDosDecimales(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function normalizarIBAN(valor) {
  return normalizarTexto(valor).toUpperCase().replace(/\s+/g, '');
}

// Obtiene la URL base de un banco a partir de su registro en la BD
async function obtenerUrlBanco(pool, codigoBanco) {
  const result = await pool
    .request()
    .input('codigo', database.sql.VarChar(10), codigoBanco)
    .query(`
      SELECT url_base, puerto
      FROM dbo.BANCO_REGISTRADO
      WHERE codigo_banco = @codigo AND activo = 1;
    `);

  const banco = result.recordset[0] || null;
  if (!banco) {
    return null;
  }

  return banco.url_base + ':' + banco.puerto;
}

// Llama a un banco destino mediante HTTP usando Axios
async function llamarBanco(url, metodo, datos) {
  const respuesta = await axios({
    method: metodo,
    url: url,
    data: datos,
    timeout: 10000
  });
  return respuesta.data;
}

// Registra una operacion en el historial interbancario
async function registrarHistorial(pool, datos) {
  const codigoResult = await pool.request().query(
    `SELECT 'OP-' + RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 20) AS codigo;`
  );
  const codigoOperacion = codigoResult.recordset[0].codigo;

  await pool
    .request()
    .input('codigo', database.sql.VarChar(30), codigoOperacion)
    .input('tipo', database.sql.VarChar(30), datos.tipo)
    .input('bancoOrigen', database.sql.VarChar(10), datos.bancoOrigen || null)
    .input('bancoDestino', database.sql.VarChar(10), datos.bancoDestino)
    .input('ibanOrigen', database.sql.VarChar(34), datos.ibanOrigen || null)
    .input('ibanDestino', database.sql.VarChar(34), datos.ibanDestino)
    .input('clienteOrigen', database.sql.VarChar(20), datos.clienteOrigen || null)
    .input('clienteDestino', database.sql.VarChar(20), datos.clienteDestino)
    .input('monto', database.sql.Decimal(18, 2), datos.monto)
    .input('moneda', database.sql.Char(3), datos.moneda)
    .input('resultado', database.sql.VarChar(20), datos.resultado)
    .input('descripcion', database.sql.NVarChar(250), datos.descripcion || null)
    .input('detalleError', database.sql.NVarChar(500), datos.detalleError || null)
    .query(`
      INSERT INTO dbo.HISTORIAL_INTERBANCARIO (
        codigo_operacion, tipo_operacion,
        banco_origen, banco_destino,
        iban_origen, iban_destino,
        identificador_cliente_origen, identificador_cliente_destino,
        monto, moneda, resultado, descripcion, detalle_error, fecha_operacion
      ) VALUES (
        @codigo, @tipo,
        @bancoOrigen, @bancoDestino,
        @ibanOrigen, @ibanDestino,
        @clienteOrigen, @clienteDestino,
        @monto, @moneda, @resultado, @descripcion, @detalleError, SYSDATETIME()
      );
    `);

  return codigoOperacion;
}

// ============================================================
// Endpoints de estado y catalogo
// ============================================================

/* ----------------------------------------------------------
   GET /api/status
   Health check
   ---------------------------------------------------------- */
router.get('/status', function (req, res) {
  return res.json({ ok: true, componente: 'BancoCentral', mensaje: 'Banco Central operativo' });
});

/* ----------------------------------------------------------
   GET /api/bancos
   Lista bancos registrados
   ---------------------------------------------------------- */
router.get('/bancos', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT codigo_banco, nombre_banco, url_base, puerto, activo
      FROM dbo.BANCO_REGISTRADO
      ORDER BY codigo_banco;
    `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando bancos.' });
  }
});

/* ----------------------------------------------------------
   GET /api/clientes
   Lista completa de clientes enroutados con todos sus detalles
   ---------------------------------------------------------- */
router.get('/clientes', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        e.identificador_cliente,
        e.telefono,
        e.iban,
        e.codigo_banco,
        e.moneda,
        e.activo AS cuenta_activa,
        e.fecha_registro,
        b.nombre_banco,
        b.url_base,
        b.puerto,
        b.activo AS banco_activo
      FROM dbo.ENRUTAMIENTO e
      INNER JOIN dbo.BANCO_REGISTRADO b
        ON b.codigo_banco = e.codigo_banco
      ORDER BY e.identificador_cliente ASC, e.fecha_registro DESC, e.iban ASC;
    `);

    const clientesMap = (result.recordset || []).reduce(function (acc, row) {
      const key = row.identificador_cliente + '|' + row.telefono;

      if (!acc[key]) {
        acc[key] = {
          identificador_cliente: row.identificador_cliente,
          telefono: row.telefono,
          cuentas: []
        };
      }

      acc[key].cuentas.push({
        iban: row.iban,
        codigo_banco: row.codigo_banco,
        nombre_banco: row.nombre_banco,
        moneda: row.moneda,
        cuenta_activa: row.cuenta_activa,
        fecha_registro: row.fecha_registro,
        banco: {
          url_base: row.url_base,
          puerto: row.puerto,
          activo: row.banco_activo
        }
      });

      return acc;
    }, {});

    const data = Object.keys(clientesMap).map(function (key) {
      const cliente = clientesMap[key];
      return Object.assign({}, cliente, {
        total_cuentas: cliente.cuentas.length
      });
    });

    return res.json({ ok: true, data: data });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando clientes enroutados.' });
  }
});

/* ----------------------------------------------------------
   GET /api/cuentas
   Lista completa de cuentas registradas en el Banco Central
   ---------------------------------------------------------- */
router.get('/cuentas', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const result = await pool.request().query(`
      SELECT
        e.id_enrutamiento,
        e.identificador_cliente,
        e.telefono,
        e.iban,
        e.codigo_banco,
        e.moneda,
        e.activo AS cuenta_activa,
        e.fecha_registro,
        b.nombre_banco,
        b.url_base,
        b.puerto,
        b.activo AS banco_activo
      FROM dbo.ENRUTAMIENTO e
      INNER JOIN dbo.BANCO_REGISTRADO b
        ON b.codigo_banco = e.codigo_banco
      ORDER BY e.fecha_registro DESC, e.id_enrutamiento DESC;
    `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando cuentas enroutadas.' });
  }
});

// ============================================================
// Endpoints de enrutamiento
// ============================================================

/* ----------------------------------------------------------
   GET /api/enrutamiento/por-telefono/:telefono
   Busca todas las cuentas asociadas a un numero de telefono
   ---------------------------------------------------------- */
router.get('/enrutamiento/por-telefono/:telefono', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const telefono = normalizarTexto(req.params.telefono);

    if (!telefono) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'Telefono requerido.' });
    }

    const result = await pool
      .request()
      .input('telefono', database.sql.VarChar(20), telefono)
      .query(`
        SELECT
          e.id_enrutamiento,
          e.identificador_cliente,
          e.telefono,
          e.iban,
          e.codigo_banco,
          e.moneda,
          b.nombre_banco,
          b.url_base,
          b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.telefono = @telefono AND e.activo = 1
        ORDER BY e.codigo_banco;
      `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error buscando por telefono.' });
  }
});

/* ----------------------------------------------------------
   GET /api/enrutamiento/por-cuenta/:iban
   Busca a que banco pertenece una cuenta
   ---------------------------------------------------------- */
router.get('/enrutamiento/por-cuenta/:iban', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const iban = normalizarIBAN(req.params.iban);

    if (!iban) {
      return res.status(400).json({ ok: false, reason: 'INVALID_INPUT', message: 'IBAN requerido.' });
    }

    const result = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`
        SELECT
          e.id_enrutamiento,
          e.identificador_cliente,
          e.telefono,
          e.iban,
          e.codigo_banco,
          e.moneda,
          b.nombre_banco,
          b.url_base,
          b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.iban = @iban AND e.activo = 1;
      `);

    const enrut = result.recordset[0] || null;
    if (!enrut) {
      return res.status(404).json({ ok: false, reason: 'NOT_FOUND', message: 'Cuenta no registrada en el Banco Central.' });
    }

    return res.json({ ok: true, data: enrut });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error buscando cuenta.' });
  }
});

/* ----------------------------------------------------------
   POST /api/enrutamiento/registrar
   Registra una cuenta en la tabla de enrutamiento.
   Llamado por bancos destino al crear cuentas (req #15).
   Body: { identificadorCliente, telefono, iban, codigoBanco, moneda }
   ---------------------------------------------------------- */
router.post('/enrutamiento/registrar', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const identificadorCliente = normalizarTexto(req.body.identificadorCliente);
    const telefono = normalizarTexto(req.body.telefono);
    const iban = normalizarIBAN(req.body.iban);
    const codigoBanco = normalizarTexto(req.body.codigoBanco).toUpperCase();
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());

    if (!identificadorCliente || !telefono || !iban || !codigoBanco) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Cliente, telefono, IBAN y banco son obligatorios.'
      });
    }

    // Verificar banco existe
    const bancoResult = await pool
      .request()
      .input('codigo', database.sql.VarChar(10), codigoBanco)
      .query(`SELECT codigo_banco FROM dbo.BANCO_REGISTRADO WHERE codigo_banco = @codigo AND activo = 1;`);

    if (bancoResult.recordset.length === 0) {
      return res.status(404).json({ ok: false, reason: 'BANK_NOT_FOUND', message: 'Banco no registrado.' });
    }

    // Verificar si el IBAN ya existe
    const existeResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), iban)
      .query(`SELECT COUNT(*) AS total FROM dbo.ENRUTAMIENTO WHERE iban = @iban;`);

    if (Number(existeResult.recordset[0].total) > 0) {
      return res.status(409).json({ ok: false, reason: 'ALREADY_EXISTS', message: 'El IBAN ya esta registrado en el enrutamiento.' });
    }

    await pool
      .request()
      .input('cliente', database.sql.VarChar(20), identificadorCliente)
      .input('telefono', database.sql.VarChar(20), telefono)
      .input('iban', database.sql.VarChar(34), iban)
      .input('banco', database.sql.VarChar(10), codigoBanco)
      .input('moneda', database.sql.Char(3), moneda)
      .query(`
        INSERT INTO dbo.ENRUTAMIENTO (
          identificador_cliente, telefono, iban, codigo_banco, moneda, activo, fecha_registro
        ) VALUES (
          @cliente, @telefono, @iban, @banco, @moneda, 1, SYSDATETIME()
        );
      `);

    return res.json({ ok: true, message: 'Enrutamiento registrado correctamente.' });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error registrando enrutamiento.' });
  }
});

// ============================================================
// Endpoints de historial
// ============================================================

/* ----------------------------------------------------------
   GET /api/historial
   Consulta el historial interbancario
   Query params: ?limite=50&banco=B&resultado=Exitosa
   ---------------------------------------------------------- */
router.get('/historial', async function (req, res) {
  try {
    const pool = await database.poolPromise;
    const limite = Math.min(Number(req.query.limite || 100), 500);
    const bancoFiltro = normalizarTexto(req.query.banco);
    const resultadoFiltro = normalizarTexto(req.query.resultado);

    let whereClause = '';
    const request = pool.request();

    if (bancoFiltro) {
      whereClause += ' AND (banco_origen = @banco OR banco_destino = @banco)';
      request.input('banco', database.sql.VarChar(10), bancoFiltro);
    }

    if (resultadoFiltro) {
      whereClause += ' AND resultado = @resultado';
      request.input('resultado', database.sql.VarChar(20), resultadoFiltro);
    }

    const result = await request.query(`
      SELECT TOP (${limite})
        id_historial,
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
      FROM dbo.HISTORIAL_INTERBANCARIO
      WHERE 1 = 1 ${whereClause}
      ORDER BY fecha_operacion DESC, id_historial DESC;
    `);

    return res.json({ ok: true, data: result.recordset || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error consultando historial.' });
  }
});

// ============================================================
// Transferencia interbancaria por numero telefonico (req #16)
// ============================================================

/* ----------------------------------------------------------
   POST /api/transferencia/por-telefono
   El banco emisor envía fondos al destinatario identificado
   por su numero de telefono. Aplica comision en banco origen.

   Body:
   {
     ibanOrigen:  "CRXXX...",     // cuenta que envia (en cualquier banco)
     telefonoDestino: "8888-1200", // a quien va el dinero
     monto: 50000,
     moneda: "CRC",
     descripcion: "Pago servicio"
   }
   ---------------------------------------------------------- */
router.post('/transferencia/por-telefono', async function (req, res) {
  const pool = await database.poolPromise;
  let historialDatos = null;

  try {
    const ibanOrigen = normalizarIBAN(req.body.ibanOrigen);
    const telefonoDestino = normalizarTexto(req.body.telefonoDestino);
    const montoTexto = normalizarTexto(req.body.monto);
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const descripcion = normalizarTexto(req.body.descripcion) || 'Transferencia interbancaria por telefono';

    if (!ibanOrigen || !telefonoDestino || !montoTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'IBAN origen, telefono destino y monto son obligatorios.'
      });
    }

    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ ok: false, reason: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' });
    }

    // 1. Buscar banco y datos de cuenta origen
    const origenEnrutResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), ibanOrigen)
      .query(`
        SELECT e.identificador_cliente, e.telefono, e.iban, e.codigo_banco, e.moneda,
               b.url_base, b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.iban = @iban AND e.activo = 1;
      `);

    const origenEnrut = origenEnrutResult.recordset[0] || null;
    if (!origenEnrut) {
      return res.status(404).json({ ok: false, reason: 'ORIGIN_NOT_FOUND', message: 'Cuenta origen no registrada en el Banco Central.' });
    }

    // 2. Buscar cuentas del destinatario por telefono en moneda compatible
    const destinoEnrutResult = await pool
      .request()
      .input('telefono', database.sql.VarChar(20), telefonoDestino)
      .input('moneda', database.sql.Char(3), moneda)
      .input('ibanOrigen', database.sql.VarChar(34), ibanOrigen)
      .query(`
        SELECT e.identificador_cliente, e.iban, e.codigo_banco, e.moneda,
               b.url_base, b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.telefono = @telefono AND e.moneda = @moneda AND e.activo = 1
          AND e.iban <> @ibanOrigen;
      `);

    // Preparar historial datos base
    historialDatos = {
      tipo: 'TransferenciaTelefono',
      bancoOrigen: origenEnrut.codigo_banco,
      ibanOrigen: ibanOrigen,
      clienteOrigen: origenEnrut.identificador_cliente,
      monto: monto,
      moneda: moneda,
      descripcion: descripcion
    };

    if (destinoEnrutResult.recordset.length === 0) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        bancoDestino: '?',
        ibanDestino: '?',
        clienteDestino: '?',
        resultado: 'Fallida',
        detalleError: 'No se encontro cuenta destino con ese telefono y moneda.'
      }));

      return res.status(404).json({
        ok: false,
        reason: 'DESTINATION_NOT_FOUND',
        message: 'No se encontro cuenta destino con ese numero de telefono y moneda.'
      });
    }

    // Usar primera cuenta encontrada para el destino
    const destinoEnrut = destinoEnrutResult.recordset[0];
    historialDatos.bancoDestino = destinoEnrut.codigo_banco;
    historialDatos.ibanDestino = destinoEnrut.iban;
    historialDatos.clienteDestino = destinoEnrut.identificador_cliente;

    const urlOrigen = origenEnrut.url_base + ':' + origenEnrut.puerto;
    const urlDestino = destinoEnrut.url_base + ':' + destinoEnrut.puerto;

    // 3. Ejecutar retiro CON comision en banco origen
    let respuestaRetiro;
    try {
      respuestaRetiro = await llamarBanco(
        urlOrigen + '/api/transacciones/retiro',
        'post',
        {
          iban: ibanOrigen,
          monto: monto,
          moneda: moneda,
          descripcion: descripcion + ' (salida)',
          tipoTransaccion: 'Transferencia',
          sinComision: false
        }
      );
    } catch (errRetiro) {
      const detalleError = (errRetiro.response && errRetiro.response.data && errRetiro.response.data.message)
        ? errRetiro.response.data.message
        : errRetiro.message;

      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Error en retiro origen: ' + detalleError
      }));

      return res.status(502).json({
        ok: false,
        reason: 'ORIGIN_WITHDRAWAL_FAILED',
        message: 'Error al ejecutar retiro en banco origen: ' + detalleError
      });
    }

    if (!respuestaRetiro.ok) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Retiro origen rechazado: ' + respuestaRetiro.message
      }));

      return res.status(409).json({
        ok: false,
        reason: 'ORIGIN_WITHDRAWAL_REJECTED',
        message: respuestaRetiro.message
      });
    }

    // 4. Ejecutar deposito en banco destino
    let respuestaDeposito;
    try {
      respuestaDeposito = await llamarBanco(
        urlDestino + '/api/transacciones/deposito',
        'post',
        {
          iban: destinoEnrut.iban,
          monto: monto,
          moneda: moneda,
          descripcion: descripcion + ' (entrada)',
          tipoTransaccion: 'Transferencia'
        }
      );
    } catch (errDeposito) {
      // El retiro ya se hizo: situacion critica, registrar con nota
      const detalleError = (errDeposito.response && errDeposito.response.data && errDeposito.response.data.message)
        ? errDeposito.response.data.message
        : errDeposito.message;

      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Retiro OK pero deposito destino fallo: ' + detalleError
      }));

      return res.status(502).json({
        ok: false,
        reason: 'DESTINATION_DEPOSIT_FAILED',
        message: 'Retiro ejecutado pero el deposito en banco destino fallo. Contacte soporte.'
      });
    }

    // 5. Registrar historial exitoso
    const codigoOp = await registrarHistorial(pool, Object.assign({}, historialDatos, {
      resultado: 'Exitosa'
    }));

    return res.json({
      ok: true,
      message: 'Transferencia por telefono realizada correctamente.',
      data: {
        codigoOperacion: codigoOp,
        ibanOrigen: ibanOrigen,
        bancOrigen: origenEnrut.codigo_banco,
        ibanDestino: destinoEnrut.iban,
        bancoDestino: destinoEnrut.codigo_banco,
        montoTransferido: monto,
        moneda: moneda,
        retiro: respuestaRetiro.data,
        deposito: respuestaDeposito ? respuestaDeposito.data : null
      }
    });
  } catch (error) {
    if (historialDatos && historialDatos.bancoDestino) {
      try {
        await registrarHistorial(pool, Object.assign({}, historialDatos, {
          resultado: 'Fallida',
          detalleError: error.message
        }));
      } catch (_) { /* historial no critico */ }
    }

    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error ejecutando transferencia.' });
  }
});

// ============================================================
// Transferencia por numero de cuenta desde B/C hacia A (req #17)
// ============================================================

/* ----------------------------------------------------------
   POST /api/transferencia/por-cuenta
   Trae fondos desde Banco B o Banco C hacia Banco A.
   Requiere mismo identificador de cliente y misma moneda.
   No genera comision (req #17).

   Body:
   {
     ibanOrigen:  "CRxxx...",   // cuenta en banco B o C
     ibanDestino: "CRyyy...",   // cuenta en banco A
     monto: 100000,
     moneda: "CRC",
     descripcion: "Traer fondos a Banco A"
   }
   ---------------------------------------------------------- */
router.post('/transferencia/por-cuenta', async function (req, res) {
  const pool = await database.poolPromise;
  let historialDatos = null;

  try {
    const ibanOrigen = normalizarIBAN(req.body.ibanOrigen);
    const ibanDestino = normalizarIBAN(req.body.ibanDestino);
    const montoTexto = normalizarTexto(req.body.monto);
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda).toUpperCase());
    const descripcion = normalizarTexto(req.body.descripcion) || 'Transferencia interbancaria por numero de cuenta';

    if (!ibanOrigen || !ibanDestino || !montoTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'IBAN origen, IBAN destino y monto son obligatorios.'
      });
    }

    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ ok: false, reason: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' });
    }

    // 1. Buscar enrutamiento de ambas cuentas
    const enrutResult = await pool
      .request()
      .input('ibanOrigen', database.sql.VarChar(34), ibanOrigen)
      .input('ibanDestino', database.sql.VarChar(34), ibanDestino)
      .query(`
        SELECT e.iban, e.identificador_cliente, e.codigo_banco, e.moneda,
               b.url_base, b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.iban IN (@ibanOrigen, @ibanDestino) AND e.activo = 1;
      `);

    const cuentas = enrutResult.recordset || [];
    const origenEnrut = cuentas.find(c => c.iban === ibanOrigen) || null;
    const destinoEnrut = cuentas.find(c => c.iban === ibanDestino) || null;

    if (!origenEnrut) {
      return res.status(404).json({ ok: false, reason: 'ORIGIN_NOT_FOUND', message: 'Cuenta origen no registrada en Banco Central.' });
    }
    if (!destinoEnrut) {
      return res.status(404).json({ ok: false, reason: 'DESTINATION_NOT_FOUND', message: 'Cuenta destino no registrada en Banco Central.' });
    }

    historialDatos = {
      tipo: 'TransferenciaCuenta',
      bancoOrigen: origenEnrut.codigo_banco,
      bancoDestino: destinoEnrut.codigo_banco,
      ibanOrigen: ibanOrigen,
      ibanDestino: ibanDestino,
      clienteOrigen: origenEnrut.identificador_cliente,
      clienteDestino: destinoEnrut.identificador_cliente,
      monto: monto,
      moneda: moneda,
      descripcion: descripcion
    };

    // 2. Validar que el destino sea Banco A
    if (destinoEnrut.codigo_banco !== 'A') {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'La cuenta destino debe pertenecer al Banco A.'
      }));

      return res.status(400).json({
        ok: false,
        reason: 'INVALID_DESTINATION',
        message: 'Solo se permite transferir hacia cuentas del Banco A (Pura Vida Banco).'
      });
    }

    // 3. Validar que el origen sea Banco B o C
    if (!['B', 'C'].includes(origenEnrut.codigo_banco)) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'La cuenta origen debe pertenecer al Banco B o Banco C.'
      }));

      return res.status(400).json({
        ok: false,
        reason: 'INVALID_ORIGIN',
        message: 'La cuenta origen debe pertenecer al Banco B o Banco C.'
      });
    }

    // 4. Validar mismo cliente
    if (origenEnrut.identificador_cliente !== destinoEnrut.identificador_cliente) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Los identificadores de cliente no coinciden.'
      }));

      return res.status(409).json({
        ok: false,
        reason: 'CLIENT_MISMATCH',
        message: 'Las cuentas deben pertenecer al mismo cliente.'
      });
    }

    // 5. Validar misma moneda en el enrutamiento
    if (origenEnrut.moneda !== destinoEnrut.moneda) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Las cuentas tienen monedas distintas: ' + origenEnrut.moneda + ' vs ' + destinoEnrut.moneda
      }));

      return res.status(409).json({
        ok: false,
        reason: 'CURRENCY_MISMATCH',
        message: 'Las cuentas deben operar en la misma moneda.'
      });
    }

    const urlOrigen = origenEnrut.url_base + ':' + origenEnrut.puerto;
    const urlDestino = destinoEnrut.url_base + ':' + destinoEnrut.puerto;

    // 6. Retiro SIN comision en banco origen (B o C)
    let respuestaRetiro;
    try {
      respuestaRetiro = await llamarBanco(
        urlOrigen + '/api/transacciones/retiro',
        'post',
        {
          iban: ibanOrigen,
          monto: monto,
          moneda: moneda,
          descripcion: descripcion + ' (salida sin comision)',
          tipoTransaccion: 'Transferencia',
          sinComision: true
        }
      );
    } catch (errRetiro) {
      const detalleError = (errRetiro.response && errRetiro.response.data && errRetiro.response.data.message)
        ? errRetiro.response.data.message
        : errRetiro.message;

      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Error en retiro origen: ' + detalleError
      }));

      return res.status(502).json({
        ok: false,
        reason: 'ORIGIN_WITHDRAWAL_FAILED',
        message: 'Error ejecutando retiro en banco origen: ' + detalleError
      });
    }

    if (!respuestaRetiro.ok) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Retiro rechazado: ' + respuestaRetiro.message
      }));

      return res.status(409).json({ ok: false, reason: 'WITHDRAWAL_REJECTED', message: respuestaRetiro.message });
    }

    // 7. Deposito en Banco A (puraviabanco usa su propio endpoint /api/transacciones/deposito)
    let respuestaDeposito;
    try {
      respuestaDeposito = await llamarBanco(
        urlDestino + '/api/transacciones/deposito',
        'post',
        {
          cuentaDeposito: ibanDestino,
          monto: monto,
          moneda: moneda,
          descripcion: descripcion + ' (entrada desde ' + origenEnrut.codigo_banco + ')'
        }
      );
    } catch (errDeposito) {
      const detalleError = (errDeposito.response && errDeposito.response.data && errDeposito.response.data.message)
        ? errDeposito.response.data.message
        : errDeposito.message;

      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Retiro OK pero deposito en Banco A fallo: ' + detalleError
      }));

      return res.status(502).json({
        ok: false,
        reason: 'DESTINATION_DEPOSIT_FAILED',
        message: 'Retiro ejecutado pero deposito en Banco A fallo. Contacte soporte.'
      });
    }

    // 8. Registrar historial exitoso
    const codigoOp = await registrarHistorial(pool, Object.assign({}, historialDatos, {
      resultado: 'Exitosa'
    }));

    return res.json({
      ok: true,
      message: 'Transferencia por cuenta realizada correctamente hacia Banco A.',
      data: {
        codigoOperacion: codigoOp,
        ibanOrigen: ibanOrigen,
        bancoOrigen: origenEnrut.codigo_banco,
        ibanDestino: ibanDestino,
        bancoDestino: destinoEnrut.codigo_banco,
        montoTransferido: monto,
        moneda: moneda,
        retiro: respuestaRetiro.data,
        deposito: respuestaDeposito ? respuestaDeposito.data : null
      }
    });
  } catch (error) {
    if (historialDatos && historialDatos.bancoDestino) {
      try {
        await registrarHistorial(pool, Object.assign({}, historialDatos, {
          resultado: 'Fallida',
          detalleError: error.message
        }));
      } catch (_) { /* historial no critico */ }
    }

    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error ejecutando transferencia.' });
  }
});

// ============================================================
// Pago desde sistema de restaurante (req #20)
// ============================================================

/* ----------------------------------------------------------
   POST /api/pago-restaurante
   El sistema de restaurante (puravia) envia el numero de cuenta
   del cliente y el monto a cobrar. El Banco Central identifica
   el banco, ejecuta el retiro y registra en el historial.

   Body:
   {
     numeroCuenta: "CRxxx...",  // IBAN del cliente
     monto: 15000,
     moneda: "CRC",
     descripcion: "Pago factura #123 - Restaurante Pura Vida"
   }
   ---------------------------------------------------------- */
router.post('/pago-restaurante', async function (req, res) {
  const pool = await database.poolPromise;
  let historialDatos = null;

  try {
    const numeroCuenta = normalizarIBAN(req.body.numeroCuenta);
    const montoTexto = normalizarTexto(req.body.monto);
    const moneda = normalizarMoneda(normalizarTexto(req.body.moneda || 'CRC').toUpperCase());
    const descripcion = normalizarTexto(req.body.descripcion) || 'Pago en restaurante';

    if (!numeroCuenta || !montoTexto) {
      return res.status(400).json({
        ok: false,
        reason: 'INVALID_INPUT',
        message: 'Numero de cuenta y monto son obligatorios.'
      });
    }

    const monto = Number(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ ok: false, reason: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' });
    }

    // 1. Buscar banco de la cuenta en el enrutamiento
    const enrutResult = await pool
      .request()
      .input('iban', database.sql.VarChar(34), numeroCuenta)
      .query(`
        SELECT e.identificador_cliente, e.iban, e.codigo_banco, e.moneda,
               b.url_base, b.puerto
        FROM dbo.ENRUTAMIENTO e
        INNER JOIN dbo.BANCO_REGISTRADO b ON b.codigo_banco = e.codigo_banco
        WHERE e.iban = @iban AND e.activo = 1;
      `);

    const enrut = enrutResult.recordset[0] || null;

    historialDatos = {
      tipo: 'PagoRestaurante',
      bancoOrigen: enrut ? enrut.codigo_banco : null,
      bancoDestino: enrut ? enrut.codigo_banco : '?',
      ibanOrigen: numeroCuenta,
      ibanDestino: numeroCuenta,
      clienteOrigen: enrut ? enrut.identificador_cliente : null,
      clienteDestino: enrut ? enrut.identificador_cliente : '?',
      monto: monto,
      moneda: moneda,
      descripcion: descripcion
    };

    if (!enrut) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        bancoDestino: '?',
        clienteDestino: '?',
        resultado: 'Fallida',
        detalleError: 'Cuenta no registrada en el Banco Central.'
      }));

      return res.status(404).json({
        ok: false,
        reason: 'ACCOUNT_NOT_FOUND',
        message: 'La cuenta no esta registrada en el Banco Central.'
      });
    }

    const urlBanco = enrut.url_base + ':' + enrut.puerto;
    const payloadRetiro = (enrut.codigo_banco === 'A')
      ? {
        cuentaRetiro: numeroCuenta,
        monto: monto,
        moneda: moneda,
        descripcion: descripcion
      }
      : {
        iban: numeroCuenta,
        monto: monto,
        moneda: moneda,
        descripcion: descripcion,
        tipoTransaccion: 'Retiro',
        sinComision: false
      };

    // 2. Ejecutar retiro en el banco correspondiente
    let respuestaRetiro;
    try {
      respuestaRetiro = await llamarBanco(
        urlBanco + '/api/transacciones/retiro',
        'post',
        payloadRetiro
      );
    } catch (errRetiro) {
      const detalleError = (errRetiro.response && errRetiro.response.data && errRetiro.response.data.message)
        ? errRetiro.response.data.message
        : errRetiro.message;

      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Error ejecutando retiro: ' + detalleError
      }));

      return res.status(502).json({
        ok: false,
        reason: 'PAYMENT_FAILED',
        message: 'Error ejecutando el cobro: ' + detalleError
      });
    }

    if (!respuestaRetiro.ok) {
      await registrarHistorial(pool, Object.assign({}, historialDatos, {
        resultado: 'Fallida',
        detalleError: 'Cobro rechazado: ' + respuestaRetiro.message
      }));

      return res.status(409).json({
        ok: false,
        reason: 'PAYMENT_REJECTED',
        message: respuestaRetiro.message
      });
    }

    // 3. Registrar historial exitoso
    const codigoOp = await registrarHistorial(pool, Object.assign({}, historialDatos, {
      resultado: 'Exitosa'
    }));

    return res.json({
      ok: true,
      message: 'Pago procesado correctamente.',
      data: {
        codigoOperacion: codigoOp,
        numeroCuenta: numeroCuenta,
        banco: enrut.codigo_banco,
        montoDebitado: monto,
        moneda: moneda,
        transaccion: respuestaRetiro.data
      }
    });
  } catch (error) {
    if (historialDatos && historialDatos.bancoDestino && historialDatos.bancoDestino !== '?') {
      try {
        await registrarHistorial(pool, Object.assign({}, historialDatos, {
          resultado: 'Fallida',
          detalleError: error.message
        }));
      } catch (_) { /* historial no critico */ }
    }

    return res.status(500).json({ ok: false, reason: 'INTERNAL_ERROR', message: 'Error procesando pago.' });
  }
});

module.exports = router;
