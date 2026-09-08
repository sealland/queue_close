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
    pool = new sql.ConnectionPool(buildConfig());
    await pool.connect();
  }
  return pool;
}

async function ensureLogTable() {
  const db = await getPool();
  await db.request().query(`
    IF OBJECT_ID(N'dbo.tbl_queue_close_log', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.tbl_queue_close_log (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        action NVARCHAR(30) NOT NULL,
        emp_code NVARCHAR(50) NOT NULL,
        emp_name NVARCHAR(200) NULL,
        SEQ NVARCHAR(10) NULL,
        Ship_point NVARCHAR(10) NULL,
        WADAT_IST DATE NULL,
        detail NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_tbl_queue_close_log_created_at DEFAULT (GETDATE())
      );

      CREATE INDEX IX_tbl_queue_close_log_close
        ON dbo.tbl_queue_close_log (action, SEQ, Ship_point, WADAT_IST, created_at DESC);
    END
  `);
}

function getQueueFilters() {
  return {
    shipPoint: process.env.DB_SHIP_POINT || 'P1',
    queuePrefix: process.env.DB_QUEUE_PREFIX || '9',
  };
}

const BASE_SELECT = `
  SELECT
    t.SEQ,
    t.Ship_point,
    CONVERT(varchar(10), t.WADAT_IST, 23) AS WADAT_IST,
    RIGHT(t.SEQ, 3) AS QueueNo,
    t.CARLICENSE,
    t.CAR_PROVINCE,
    t.AR_NAME,
    t.Telephone,
    t.SalesReason,
    t.visit_Status,
    CONVERT(varchar(19), t.VisitTime, 120) AS VisitTime,
    CONVERT(varchar(19), t.OutTime, 120) AS OutTime,
    closer.emp_code AS ClosedByCode,
    closer.emp_name AS ClosedByName,
    CONVERT(varchar(19), closer.created_at, 120) AS ClosedAt
  FROM tbl_shipment_carvisit t
  OUTER APPLY (
    SELECT TOP 1 l.emp_code, l.emp_name, l.created_at
    FROM tbl_queue_close_log l
    WHERE l.action = N'close'
      AND l.SEQ = t.SEQ
      AND l.Ship_point = t.Ship_point
      AND CAST(l.WADAT_IST AS DATE) = CAST(t.WADAT_IST AS DATE)
    ORDER BY l.created_at DESC
  ) closer
`;

function baseWhereClause() {
  return `
    t.Ship_point = @shipPoint
    AND LEFT(t.SEQ, 1) = @queuePrefix
    AND ISNULL(t.DOCTYPE, '') <> N'จัดสาย'
  `;
}

async function getTodayQueue() {
  const db = await getPool();
  const { shipPoint, queuePrefix } = getQueueFilters();

  const result = await db
    .request()
    .input('shipPoint', sql.NVarChar(10), shipPoint)
    .input('queuePrefix', sql.NVarChar(1), queuePrefix)
    .query(`
      ${BASE_SELECT}
      WHERE ${baseWhereClause()}
        AND t.OutTime IS NULL
        AND CAST(t.VisitTime AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY t.VisitTime ASC
    `);

  return result.recordset;
}

async function getHistory({ status, dateFrom, dateTo }) {
  const db = await getPool();
  const { shipPoint, queuePrefix } = getQueueFilters();

  let statusClause = '';
  if (status === 'open') {
    statusClause = 'AND t.OutTime IS NULL';
  } else if (status === 'closed') {
    statusClause = 'AND t.OutTime IS NOT NULL';
  }

  const result = await db
    .request()
    .input('shipPoint', sql.NVarChar(10), shipPoint)
    .input('queuePrefix', sql.NVarChar(1), queuePrefix)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .query(`
      ${BASE_SELECT}
      WHERE ${baseWhereClause()}
        AND CAST(t.VisitTime AS DATE) BETWEEN @dateFrom AND @dateTo
        ${statusClause}
      ORDER BY t.VisitTime ASC
    `);

  return result.recordset;
}

async function closeQueue({ seq, ship_point, wadat_ist }) {
  const db = await getPool();

  const result = await db
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
  const db = await getPool();

  const result = await db
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

async function insertTransactionLog({
  action,
  emp_code,
  emp_name,
  seq = null,
  ship_point = null,
  wadat_ist = null,
  detail = null,
}) {
  const db = await getPool();
  const detailText = detail == null ? null : typeof detail === 'string' ? detail : JSON.stringify(detail);

  await db
    .request()
    .input('action', sql.NVarChar(30), action)
    .input('emp_code', sql.NVarChar(50), emp_code)
    .input('emp_name', sql.NVarChar(200), emp_name || null)
    .input('seq', sql.NVarChar(10), seq)
    .input('ship_point', sql.NVarChar(10), ship_point)
    .input('wadat_ist', sql.Date, wadat_ist)
    .input('detail', sql.NVarChar(sql.MAX), detailText)
    .query(`
      INSERT INTO tbl_queue_close_log
        (action, emp_code, emp_name, SEQ, Ship_point, WADAT_IST, detail)
      VALUES
        (@action, @emp_code, @emp_name, @seq, @ship_point, @wadat_ist, @detail)
    `);
}

async function testConnection() {
  const db = await getPool();
  const result = await db.request().query('SELECT 1 AS ok');
  return result.recordset[0].ok === 1;
}

module.exports = {
  sql,
  getPool,
  ensureLogTable,
  getTodayQueue,
  getHistory,
  closeQueue,
  updateQueue,
  insertTransactionLog,
  testConnection,
  getQueueFilters,
};
