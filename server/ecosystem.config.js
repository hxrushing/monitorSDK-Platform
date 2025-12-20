// 加载 .env 文件
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

module.exports = {
  apps: [{
    name: 'analytics-api',
    script: './dist/app.js',
    cwd: '/www/wwwroot/default/server',
    instances: 1,
    exec_mode: 'fork',
    // 从 process.env 读取环境变量（已在上面加载）
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME,
      DB_POOL_LIMIT: process.env.DB_POOL_LIMIT
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    source_map_support: true,
    instance_var: 'INSTANCE_ID'
  }]
};

