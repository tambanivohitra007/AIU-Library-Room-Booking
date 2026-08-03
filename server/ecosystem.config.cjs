module.exports = {
  apps: [{
    name: 'aiu-library-api',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork', // Changed from 'cluster' - SQLite works better with single instance
    env: {
      NODE_ENV: 'production',
      // Booking hours, the scheduler and email times all use the process's local
      // timezone (Date#getHours). Pin it so production matches the institution's
      // wall clock instead of inheriting the host default (UTC on most Linux servers).
      TZ: 'Asia/Bangkok',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
  }]
};
