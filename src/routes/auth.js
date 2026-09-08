const express = require('express');
const { testHrConnection } = require('../hrDb');
const { requireEmployee } = require('../middleware/requireEmployee');

const router = express.Router();

router.get('/me', requireEmployee, async (req, res) => {
  res.json({
    ok: true,
    emp_code: req.employee.emp_code,
    emp_name: req.employee.emp_name,
  });
});

router.get('/health', async (req, res) => {
  try {
    await testHrConnection();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
