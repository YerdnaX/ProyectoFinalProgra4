var express = require('express');
var router = express.Router();
var axios = require('axios');

var BANCO_CENTRAL_URL = 'http://localhost:3002';

// ============================================================
// Vista principal de transferencias interbancarias
// ============================================================

router.get('/', function (req, res, next) {
  res.render('interbancario', { title: 'Transferencias Interbancarias' });
});

// ============================================================
// Proxy: Enviar dinero a otro banco por teléfono (req #16)
// Body esperado por bancoCentral:
//   { ibanOrigen, telefonoDestino, monto, moneda, descripcion }
// ============================================================

router.post('/enviar-por-telefono', async function (req, res, next) {
  try {
    var respuesta = await axios.post(
      BANCO_CENTRAL_URL + '/api/transferencia/por-telefono',
      req.body,
      { timeout: 15000 }
    );
    return res.status(respuesta.status).json(respuesta.data);
  } catch (err) {
    var data = (err.response && err.response.data) ? err.response.data : {};
    var status = (err.response && err.response.status) ? err.response.status : 502;
    return res.status(status).json({
      ok: false,
      message: data.message || 'No se pudo conectar con el Banco Central.'
    });
  }
});

// ============================================================
// Proxy: Traer dinero desde otro banco hacia Banco A (req #17)
// Body esperado por bancoCentral:
//   { ibanOrigen, ibanDestino, monto, moneda, descripcion }
// El banco destino debe ser siempre Banco A.
// ============================================================

router.post('/traer-desde-otro-banco', async function (req, res, next) {
  try {
    var respuesta = await axios.post(
      BANCO_CENTRAL_URL + '/api/transferencia/por-cuenta',
      req.body,
      { timeout: 15000 }
    );
    return res.status(respuesta.status).json(respuesta.data);
  } catch (err) {
    var data = (err.response && err.response.data) ? err.response.data : {};
    var status = (err.response && err.response.status) ? err.response.status : 502;
    return res.status(status).json({
      ok: false,
      message: data.message || 'No se pudo conectar con el Banco Central.'
    });
  }
});

module.exports = router;
