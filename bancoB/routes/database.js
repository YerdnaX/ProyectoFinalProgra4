const sql = require('mssql/msnodesqlv8');

// Conexion con autenticacion integrada a bancoBDB
const config = {
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=bancoBDB;Trusted_Connection=yes;',
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Banco B: Conectado a bancoBDB');
    return pool;
  })
  .catch(err => {
    console.error('Banco B: Error al conectar a bancoBDB', err);
    throw err;
  });

module.exports = { sql, poolPromise };
