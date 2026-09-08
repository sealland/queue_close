module.exports = {
  apps: [
    {
      name: 'queue-close',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3032,
        HOST: '0.0.0.0',
      },
    },
  ],
};
