-- 为projects表添加owner_id字段
-- 用于记录项目的创建者/所有者

USE `sdk-platform`;

-- 检查并添加owner_id字段（MySQL 8.0.19+ 支持 IF NOT EXISTS）
-- 如果您的MySQL版本较低，可能需要先手动检查列是否存在
-- 或者直接执行，如果列已存在会报错，可以忽略

-- 方法1：直接添加（如果列已存在会报错，需要手动处理）
ALTER TABLE projects 
ADD COLUMN owner_id VARCHAR(36) NULL COMMENT '项目所有者/创建者ID' AFTER description;

-- 添加索引
ALTER TABLE projects 
ADD INDEX idx_owner_id (owner_id);

-- 添加外键约束（可选，如果希望保持数据完整性）
-- 注意：由于现有数据可能owner_id为NULL，所以外键约束允许NULL
-- 如果需要，可以取消下面的注释来添加外键约束
-- ALTER TABLE projects 
-- ADD CONSTRAINT fk_projects_owner 
-- FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 如果您使用的是较旧版本的MySQL，可以使用下面的存储过程方式
-- ============================================
/*
DELIMITER $$

DROP PROCEDURE IF EXISTS add_owner_id_column$$

CREATE PROCEDURE add_owner_id_column()
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    -- 检查列是否存在
    SELECT COUNT(*) INTO column_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        AND COLUMN_NAME = 'owner_id';
    
    -- 如果列不存在，则添加
    IF column_exists = 0 THEN
        ALTER TABLE projects 
        ADD COLUMN owner_id VARCHAR(36) NULL COMMENT '项目所有者/创建者ID' AFTER description;
        
        ALTER TABLE projects 
        ADD INDEX idx_owner_id (owner_id);
        
        SELECT 'owner_id字段添加成功' AS result;
    ELSE
        SELECT 'owner_id字段已存在，跳过' AS result;
    END IF;
END$$

DELIMITER ;

CALL add_owner_id_column();
DROP PROCEDURE IF EXISTS add_owner_id_column;
*/

