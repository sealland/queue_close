require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const queueRoutes = require('./src/routes/queue');
const authRoutes = require('./src/routes/auth');
const { testConnection, ensureLogTable } = require('./src/db');
const { testHrConnection } = require('./src/hrDb');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

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
    console.log(`  Local:   http://localhost:${PORT}`);

    const ips = getLocalIPv4();
    if (ips.length) {
      console.log('  Network:');
      ips.forEach((ip) => console.log(`           http://${ip}:${PORT}`));
    } else {
      console.log('  Network: (no LAN IP detected)');
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
