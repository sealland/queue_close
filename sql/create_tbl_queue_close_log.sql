-- Auto-created by app on startup (ensureLogTable).
-- Run manually if needed on queue database (e.g. PP).

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
