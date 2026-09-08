# Current User + Transaction Log Design

Approved: 2026-09-08

## Summary

- Accept `?currentUser=<emp_code>` (required).
- Validate against HR SQL Server (`ZHR_EMPLOYEE`) on a separate connection.
- Active employee = `PRI_RES_D IS NULL`.
- Show employee name top-right.
- Log every transaction (view today, view history, close, update) in queue DB table `tbl_queue_close_log`.
- Show closer name on closed queue rows.

## Connections

- Queue DB: existing `DB_*` env vars.
- HR DB: `HR_DB_*` env vars (separate server/IP/database).
