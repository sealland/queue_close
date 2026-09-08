const { findActiveEmployee } = require('../hrDb');

async function requireEmployee(req, res, next) {
  try {
    const code =
      req.headers['x-current-user'] ||
      req.query.currentUser ||
      (req.body && req.body.currentUser);

    if (!code || !String(code).trim()) {
      return res.status(401).json({ error: 'ต้องระบุ currentUser (รหัสพนักงาน)' });
    }

    const employee = await findActiveEmployee(String(code).trim());
    if (!employee) {
      return res.status(403).json({ error: 'ไม่พบพนักงาน หรือพ้นสภาพแล้ว' });
    }

    req.employee = employee;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message || 'ตรวจสอบพนักงานไม่สำเร็จ' });
  }
}

module.exports = { requireEmployee };
