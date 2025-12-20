const fs = require('fs');
const path = require('path');

// 读取 .env 文件
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('错误: .env 文件不存在');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// 检查当前的 DB_HOST 配置
const dbHostMatch = envContent.match(/^DB_HOST=(.+)$/m);
if (dbHostMatch) {
  const currentHost = dbHostMatch[1].trim();
  console.log(`当前 DB_HOST: ${currentHost}`);
  
  // 如果是公网 IP，替换为 127.0.0.1
  if (currentHost === '120.26.41.57' || currentHost.includes('120.26.41.57')) {
    envContent = envContent.replace(/^DB_HOST=.*$/m, 'DB_HOST=127.0.0.1');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ 已修复: DB_HOST 已更改为 127.0.0.1');
  } else if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    console.log('✅ DB_HOST 配置正确，无需修改');
  } else {
    console.log(`⚠️  警告: DB_HOST 为 ${currentHost}，建议使用 127.0.0.1 或 localhost`);
    console.log('是否要将其更改为 127.0.0.1? (y/n)');
    // 自动修复
    envContent = envContent.replace(/^DB_HOST=.*$/m, 'DB_HOST=127.0.0.1');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ 已自动修复: DB_HOST 已更改为 127.0.0.1');
  }
} else {
  console.log('⚠️  未找到 DB_HOST 配置，正在添加...');
  envContent += '\nDB_HOST=127.0.0.1\n';
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ 已添加: DB_HOST=127.0.0.1');
}

// 验证修改结果
const newDbHostMatch = envContent.match(/^DB_HOST=(.+)$/m);
if (newDbHostMatch) {
  console.log(`\n验证: 当前 DB_HOST = ${newDbHostMatch[1].trim()}`);
}

console.log('\n请重启 PM2 服务以使配置生效:');
console.log('  pm2 restart analytics-api');

