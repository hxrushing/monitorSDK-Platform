const mysql = require('mysql2/promise');
require('dotenv').config();

async function dropDatabase() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4'
    });

    console.log('数据库连接成功');

    // 删除数据库
    await connection.query('DROP DATABASE IF EXISTS `sdk-platform`');
    
    console.log('数据库删除成功');
    
    // 关闭连接
    await connection.end();
    
    process.exit(0);
  } catch (error) {
    console.error('数据库删除失败:', error);
    process.exit(1);
  }
}

dropDatabase(); 