require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const queueRoutes = require('./src/routes/queue');
const authRoutes = require('./src/routes/auth');
const { testConnection, ensureLogTable } = require('./src/db');
const { testHrConnection } = require('./src/hrDb');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function normalizeBasePath(raw) {
  let base = String(raw || '').trim();
  if (!base || base === '/') return '';
  if (!base.startsWith('/')) base = `/${base}`;
  return base.replace(/\/+$/, '');
}

// BASE_PATH = path ที่เบราว์เซอร์ใช้ใน HTML/JS (เช่น /queue-close)
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

function sendPage(res, fileName) {
  const filePath = path.join(__dirname, 'public', fileName);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.split('{{BASE_PATH}}').join(BASE_PATH);
  res.type('html').send(html);
}

app.use(express.json());

const router = express.Router();

// หน้า HTML ต้องผ่าน sendPage ก่อน static (ไม่เช่นนั้น {{BASE_PATH}} จะไม่ถูกแทน)
router.get('/', (req, res) => sendPage(res, 'index.html'));
router.get('/history', (req, res) => sendPage(res, 'history.html'));

router.use(express.static(path.join(__dirname, 'public'), { index: false }));
router.use('/api/auth', authRoutes);
router.use('/api/queue', queueRoutes);

// Mount ที่ root เสมอ — รองรับ reverse proxy ที่ตัด /queue-close ออก
app.use(router);

// Mount ซ้ำที่ BASE_PATH — รองรับเข้าตรง / หรือ proxy ที่ไม่ตัด path
if (BASE_PATH) {
  app.use(BASE_PATH, router);
}

async function start() {
  try {
    await testConnection();
    await ensureLogTable();
    console.log('Queue database connected successfully');
  } catch (err) {
    console.error('Queue database connection failed:', err.message || err);
    process.exit(1);
  }

  try {
    await testHrConnection();
    console.log('HR database connected successfully');
  } catch (err) {
    console.error('HR database connection failed:', err.message || err);
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`  BASE_PATH: ${BASE_PATH || '(root)'}`);
    console.log(`  Local:     http://localhost:${PORT}/`);
    if (BASE_PATH) {
      console.log(`             http://localhost:${PORT}${BASE_PATH}/`);
    }

    const ips = getLocalIPv4();
    if (ips.length) {
      console.log('  Network:');
      ips.forEach((ip) => {
        console.log(`             http://${ip}:${PORT}/`);
        if (BASE_PATH) console.log(`             http://${ip}:${PORT}${BASE_PATH}/`);
      });
    }
  });
}

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  const ips = [];

  for (const entries of Object.values(nets)) {
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  return ips;
}

start();
