require('dotenv').config();

function getAuthType() {
  return (process.env.DB_AUTH_TYPE || 'windows').toLowerCase();
}

function loadSqlDriver() {
  if (getAuthType() === 'windows') {
    return require('mssql/msnodesqlv8');
  }
  return require('mssql');
}

const sql = loadSqlDriver();

function buildConfig() {
  const authType = getAuthType();
  const trustCert = process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false';
  const encrypt = process.env.DB_ENCRYPT !== 'false';
  const server = process.env.DB_SERVER || 'localhost';
  const database = process.env.DB_NAME || 'AI_LOCAL_PP';
  const trust = trustCert ? 'yes' : 'no';
  const enc = encrypt ? 'yes' : 'no';

  const config = {
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (authType === 'sql') {
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    if (!user || !password) {
      throw new Error('DB_AUTH_TYPE=sql requires DB_USER and DB_PASSWORD');
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

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(buildConfig());
  }
  return pool;
}

function getQueueFilters() {
  return {
    shipPoint: process.env.DB_SHIP_POINT || 'P1',
    queuePrefix: process.env.DB_QUEUE_PREFIX || '9',
  };
}

const BASE_SELECT = `
  SELECT
    SEQ,
    Ship_point,
    CONVERT(varchar(10), WADAT_IST, 23) AS WADAT_IST,
    RIGHT(SEQ, 3) AS QueueNo,
    CARLICENSE,
    CAR_PROVINCE,
    AR_NAME,
    Telephone,
    SalesReason,
    visit_Status,
    CONVERT(varchar(19), VisitTime, 120) AS VisitTime,
    CONVERT(varchar(19), OutTime, 120) AS OutTime
  FROM tbl_shipment_carvisit
`;

function baseWhereClause() {
  return `
    Ship_point = @shipPoint
    AND LEFT(SEQ, 1) = @queuePrefix
    AND ISNULL(DOCTYPE, '') <> N'จัดสาย'
  `;
}

async function getTodayQueue() {
  const pool = await getPool();
  const { shipPoint, queuePrefix } = getQueueFilters();

  const result = await pool
    .request()
    .input('shipPoint', sql.NVarChar(10), shipPoint)
    .input('queuePrefix', sql.NVarChar(1), queuePrefix)
    .query(`
      ${BASE_SELECT}
      WHERE ${baseWhereClause()}
        AND OutTime IS NULL
        AND CAST(VisitTime AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY VisitTime ASC
    `);

  return result.recordset;
}

async function getHistory({ status, dateFrom, dateTo }) {
  const pool = await getPool();
  const { shipPoint, queuePrefix } = getQueueFilters();

  let statusClause = '';
  if (status === 'open') {
    statusClause = 'AND OutTime IS NULL';
  } else if (status === 'closed') {
    statusClause = 'AND OutTime IS NOT NULL';
  }

  const result = await pool
    .request()
    .input('shipPoint', sql.NVarChar(10), shipPoint)
    .input('queuePrefix', sql.NVarChar(1), queuePrefix)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .query(`
      ${BASE_SELECT}
      WHERE ${baseWhereClause()}
        AND CAST(VisitTime AS DATE) BETWEEN @dateFrom AND @dateTo
        ${statusClause}
      ORDER BY VisitTime ASC
    `);

  return result.recordset;
}

async function closeQueue({ seq, ship_point, wadat_ist }) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input('seq', sql.NVarChar(10), seq)
    .input('ship_point', sql.NVarChar(10), ship_point)
    .input('wadat_ist', sql.DateTime, wadat_ist)
    .query(`
      UPDATE tbl_shipment_carvisit
      SET OutTime = GETDATE()
      WHERE SEQ = @seq
        AND Ship_point = @ship_point
        AND WADAT_IST = @wadat_ist
        AND OutTime IS NULL
    `);

  return result.rowsAffected[0];
}

async function updateQueue({ seq, ship_point, wadat_ist, carlicense, ar_name, telephone, sales_reason }) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input('seq', sql.NVarChar(10), seq)
    .input('ship_point', sql.NVarChar(10), ship_point)
    .input('wadat_ist', sql.Date, wadat_ist)
    .input('carlicense', sql.NVarChar(20), carlicense ?? '')
    .input('ar_name', sql.VarChar(100), ar_name ?? '')
    .input('telephone', sql.NVarChar(30), telephone ?? '')
    .input('sales_reason', sql.NVarChar(300), sales_reason ?? '')
    .query(`
      UPDATE tbl_shipment_carvisit
      SET CARLICENSE = @carlicense,
          AR_NAME = @ar_name,
          Telephone = @telephone,
          SalesReason = @sales_reason
      WHERE SEQ = @seq
        AND Ship_point = @ship_point
        AND WADAT_IST = @wadat_ist
    `);

  return result.rowsAffected[0];
}

async function testConnection() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT 1 AS ok');
  return result.recordset[0].ok === 1;
}

module.exports = {
  sql,
  getPool,
  getTodayQueue,
  getHistory,
  closeQueue,
  updateQueue,
  testConnection,
  getQueueFilters,
};
