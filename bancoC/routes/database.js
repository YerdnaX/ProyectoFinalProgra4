const sql = require('mssql/msnodesqlv8');

// Conexion con autenticacion integrada a bancoCDB
const config = {
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=bancoCDB;Trusted_Connection=yes;',
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Banco C: Conectado a bancoCDB');
    return pool;
  })
  .catch(err => {
    console.error('Banco C: Error al conectar a bancoCDB', err);
    throw err;
  });

module.exports = { sql, poolPromise };
