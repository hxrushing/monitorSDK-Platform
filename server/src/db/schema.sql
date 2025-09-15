-- 这里可以添加其他表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 插入测试用户
-- 密码是123456
INSERT INTO users (id, username, password, email) VALUES 
('1', 'admin', 'e10adc3949ba59abbe56e057f20f883e', 'admin@example.com'),
('2', 'user', 'e10adc3949ba59abbe56e057f20f883e', 'user@example.com'); 