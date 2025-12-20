#!/usr/bin/env node

// 检查环境变量脚本
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

console.log('=== 环境变量诊断 ===\n');

// 1. 检查 .env 文件是否存在
const envPath = path.join(__dirname, '.env');
console.log('1. 检查 .env 文件:');
console.log(`   路径: ${envPath}`);
console.log(`   存在: ${fs.existsSync(envPath) ? '✅' : '❌'}`);

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbHostMatch = envContent.match(/DB_HOST\s*=\s*(.+)/);
  if (dbHostMatch) {
    console.log(`   DB_HOST 值: ${dbHostMatch[1].trim()}`);
  } else {
    console.log('   ⚠️  未找到 DB_HOST 配置');
  }
}

console.log('\n2. 当前进程环境变量:');
console.log(`   DB_HOST: ${process.env.DB_HOST || '未设置'}`);
console.log(`   工作目录: ${process.cwd()}`);

console.log('\n3. 使用 dotenv 加载后:');
dotenv.config({ path: envPath });
console.log(`   DB_HOST: ${process.env.DB_HOST || '未设置'}`);

console.log('\n4. 检查所有数据库相关环境变量:');
const dbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];
dbVars.forEach(key => {
  const value = process.env[key];
  if (key === 'DB_PASSWORD') {
    console.log(`   ${key}: ${value ? '***已设置***' : '未设置'}`);
  } else {
    console.log(`   ${key}: ${value || '未设置'}`);
  }
});

console.log('\n=== 诊断完成 ===');

