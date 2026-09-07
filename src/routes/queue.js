const express = require('express');
const {
  getTodayQueue,
  getHistory,
  closeQueue,
  updateQueue,
  testConnection,
  getQueueFilters,
} = require('../db');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, filters: getQueueFilters() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const rows = await getTodayQueue();
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

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
