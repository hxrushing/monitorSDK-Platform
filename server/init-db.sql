-- 创建数据库
CREATE DATABASE IF NOT EXISTS `sdk-platform` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sdk-platform`;

-- 设置连接字符集和时区
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+08:00';

-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建事件定义表
CREATE TABLE IF NOT EXISTS event_definitions (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    params_schema JSON,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_event_name (project_id, event_name),
    FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建事件数据表
CREATE TABLE IF NOT EXISTS events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_params JSON,
    user_id VARCHAR(100),
    device_info JSON,
    timestamp DATETIME(3) NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_project_event (project_id, event_name),
    INDEX idx_timestamp (timestamp),
    INDEX idx_user (user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建用户表（包含角色）
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'User',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入示例用户（密码均为 123456）
INSERT INTO users (id, username, password, email, role) VALUES 
('1', 'admin', 'e10adc3949ba59abbe56e057f20f883e', 'admin@example.com', 'Admin')
ON DUPLICATE KEY UPDATE role = VALUES(role);

INSERT INTO users (id, username, password, email, role) VALUES 
('2', 'user', 'e10adc3949ba59abbe56e057f20f883e', 'user@example.com', 'User')
ON DUPLICATE KEY UPDATE role = VALUES(role);

-- 插入示例项目
INSERT INTO projects (id, name, description) 
VALUES ('demo-project', '示例项目', '用于演示的项目')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description);

-- 插入示例事件定义
INSERT INTO event_definitions (id, project_id, event_name, description, params_schema)
VALUES 
    ('evt-001', 'demo-project', 'pageview', '页面访问事件', '{"path": "string", "title": "string"}'),
    ('evt-002', 'demo-project', 'click', '点击事件', '{"elementInfo": "object"}'),
    ('evt-003', 'demo-project', 'error', '错误事件', '{"message": "string", "stack": "string"}'),
    ('evt-004', 'demo-project', 'custom_test_event', '自定义测试事件', '{"testParam1": "string", "testParam2": "string"}')
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    params_schema = VALUES(params_schema);

-- 插入更多示例事件数据
INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp)
VALUES 
    -- 页面访问事件
    ('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-1', 
     '{"userAgent": "Mozilla/5.0", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', 
     NOW()),
    ('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-1', 
     '{"userAgent": "Mozilla/5.0", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', 
     DATE_SUB(NOW(), INTERVAL 1 HOUR)),
     
    -- 其他用户事件
    ('demo-project', 'click', '{"elementInfo": {"tagName": "button", "className": "buy-btn", "id": "buy", "text": "立即购买"}}',
     'user-1', '{"userAgent": "Mozilla/5.0", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}',
     DATE_SUB(NOW(), INTERVAL 55 MINUTE)); 