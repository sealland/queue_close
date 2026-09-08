require('dotenv').config();

function getHrAuthType() {
  return (process.env.HR_DB_AUTH_TYPE || process.env.DB_AUTH_TYPE || 'sql').toLowerCase();
}

function loadHrSqlDriver() {
  if (getHrAuthType() === 'windows') {
    return require('mssql/msnodesqlv8');
  }
  return require('mssql');
}

const sql = loadHrSqlDriver();
let pool = null;

function buildHrConfig() {
  const authType = getHrAuthType();
  // Default false: many older HR SQL Servers fail TLS handshake with Node/OpenSSL
  const trustCert = process.env.HR_DB_TRUST_SERVER_CERTIFICATE !== 'false';
  const encrypt = process.env.HR_DB_ENCRYPT === 'true';
  const server = process.env.HR_DB_SERVER;
  const database = process.env.HR_DB_NAME;

  if (!server || !database) {
    throw new Error('HR_DB_SERVER and HR_DB_NAME are required');
  }

  const trust = trustCert ? 'yes' : 'no';
  const enc = encrypt ? 'yes' : 'no';

  const config = {
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  if (authType === 'sql') {
    const user = process.env.HR_DB_USER;
    const password = process.env.HR_DB_PASSWORD;
    if (!user || !password) {
      throw new Error('HR_DB_AUTH_TYPE=sql requires HR_DB_USER and HR_DB_PASSWORD');
    }
    Object.assign(config, {
      server,
      database,
      user,
      password,
      options: {
        encrypt,
        trustServerCertificate: trustCert,
        enableArithAbort: true,
      },
    });
  } else {
    config.driver = 'msnodesqlv8';
    config.connectionString =
      `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};` +
      `Trusted_Connection=yes;Encrypt=${enc};TrustServerCertificate=${trust};`;
  }

  return config;
}

async function getHrPool() {
  if (!pool) {
    pool = new sql.ConnectionPool(buildHrConfig());
    await pool.connect();
  }
  return pool;
}

async function findActiveEmployee(empCode) {
  const code = String(empCode || '').trim();
  if (!code) return null;

  const hrPool = await getHrPool();
  const result = await hrPool
    .request()
    .input('empCode', sql.NVarChar(50), code)
    .query(`
      SELECT TOP 1
        LTRIM(RTRIM(emp_code)) AS emp_code,
        LTRIM(RTRIM(emp_name)) AS emp_name
      FROM ZHR_EMPLOYEE
      WHERE LTRIM(RTRIM(emp_code)) = @empCode
        AND PRI_RES_D IS NULL
    `);

  return result.recordset[0] || null;
}

async function testHrConnection() {
  const hrPool = await getHrPool();
  const result = await hrPool.request().query('SELECT 1 AS ok');
  return result.recordset[0].ok === 1;
}

module.exports = {
  sql,
  getHrPool,
  findActiveEmployee,
  testHrConnection,
};
