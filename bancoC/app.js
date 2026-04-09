var createError = require('http-errors');
var express = require('express');
var logger = require('morgan');

var apiRouter = require('./routes/api');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', apiRouter);

// 404
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler - responde JSON (backend only, sin vistas)
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    ok: false,
    reason: 'ERROR',
    message: err.message || 'Error interno del servidor.'
  });
});

module.exports = app;
