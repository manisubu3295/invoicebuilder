module.exports = {
  apps: [
    {
      name: 'akb-transport',
      script: 'backend/src/app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Restart on crash, but not more than 5 times in 60s
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 3000,
      // Logging
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
