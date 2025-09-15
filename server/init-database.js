const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true, // 允许执行多条SQL语句
      charset: 'utf8mb4'
    });

    console.log('数据库连接成功');

    // 读取SQL文件
    const sqlFile = await fs.readFile(path.join(__dirname, 'init-db.sql'), 'utf8');
    
    // 执行SQL语句
    await connection.query(sqlFile);
    
    console.log('数据库初始化成功');
    
    // 关闭连接
    await connection.end();
    
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initializeDatabase(); 