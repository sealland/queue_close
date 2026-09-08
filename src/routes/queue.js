const express = require('express');
const {
  getTodayQueue,
  getHistory,
  closeQueue,
  updateQueue,
  insertTransactionLog,
  testConnection,
  getQueueFilters,
} = require('../db');
const { requireEmployee } = require('../middleware/requireEmployee');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, filters: getQueueFilters() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.use(requireEmployee);

router.get('/today', async (req, res) => {
  try {
    const rows = await getTodayQueue();
    await insertTransactionLog({
      action: 'view_today',
      emp_code: req.employee.emp_code,
      emp_name: req.employee.emp_name,
      detail: { count: rows.length },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { status = 'all', dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    }

    if (!['all', 'open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'status must be all, open, or closed' });
    }

    const rows = await getHistory({ status, dateFrom, dateTo });
    await insertTransactionLog({
      action: 'view_history',
      emp_code: req.employee.emp_code,
      emp_name: req.employee.emp_name,
      detail: { status, dateFrom, dateTo, count: rows.length },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/close', async (req, res) => {
  try {
    const { seq, ship_point, wadat_ist } = req.body;

    if (!seq || !ship_point || !wadat_ist) {
      return res.status(400).json({ error: 'seq, ship_point, and wadat_ist are required' });
    }

    const affected = await closeQueue({ seq, ship_point, wadat_ist });

    if (affected === 0) {
      return res.status(404).json({ error: 'Record not found or already closed' });
    }

    await insertTransactionLog({
      action: 'close',
      emp_code: req.employee.emp_code,
      emp_name: req.employee.emp_name,
      seq,
      ship_point,
      wadat_ist,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    const { seq, ship_point, wadat_ist, carlicense, ar_name, telephone, sales_reason } = req.body;

    if (!seq || !ship_point || !wadat_ist) {
      return res.status(400).json({ error: 'seq, ship_point, and wadat_ist are required' });
    }

    const affected = await updateQueue({
      seq,
      ship_point,
      wadat_ist,
      carlicense,
      ar_name,
      telephone,
      sales_reason,
    });

    if (affected === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await insertTransactionLog({
      action: 'update',
      emp_code: req.employee.emp_code,
      emp_name: req.employee.emp_name,
      seq,
      ship_point,
      wadat_ist,
      detail: { carlicense, ar_name, telephone, sales_reason },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
