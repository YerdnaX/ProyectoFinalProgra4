const sql = require('mssql/msnodesqlv8');

// Conexion con autenticacion integrada a bancoCentralDB
const config = {
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=bancoCentralDB;Trusted_Connection=yes;',
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Banco Central: Conectado a bancoCentralDB');
    return pool;
  })
  .catch(err => {
    console.error('Banco Central: Error al conectar a bancoCentralDB', err);
    throw err;
  });

module.exports = { sql, poolPromise };
