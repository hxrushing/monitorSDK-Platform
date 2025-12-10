-- 数据库索引优化脚本
-- 用于提升百万级数据查询性能

USE `sdk-platform`;

-- 1. 检查现有索引
SHOW INDEX FROM events;

-- 2. 创建复合索引（project_id + timestamp）- 最常用的查询组合
-- MySQL不支持IF NOT EXISTS，使用存储过程来检查
DROP PROCEDURE IF EXISTS create_index_if_not_exists;

DELIMITER $$

CREATE PROCEDURE create_index_if_not_exists(
    IN index_name VARCHAR(100),
    IN table_name VARCHAR(100),
    IN index_columns VARCHAR(500)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
        AND table_name = table_name
        AND index_name = index_name;
    
    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', index_name, ' ON ', table_name, '(', index_columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('索引 ', index_name, ' 创建成功') AS result;
    ELSE
        SELECT CONCAT('索引 ', index_name, ' 已存在，跳过') AS result;
    END IF;
END$$

DELIMITER ;

-- 3. 创建索引（如果不存在）
CALL create_index_if_not_exists('idx_project_timestamp', 'events', 'project_id, timestamp');
CALL create_index_if_not_exists('idx_project_event', 'events', 'project_id, event_name');
CALL create_index_if_not_exists('idx_user_id', 'events', 'user_id');
CALL create_index_if_not_exists('idx_project_user_timestamp', 'events', 'project_id, user_id, timestamp');

-- 4. 创建日期索引（MySQL 8.0+ 支持函数索引）
-- 如果MySQL版本 < 8.0，使用普通timestamp索引
-- 使用存储过程来处理，避免索引已存在时报错

DELIMITER $$

CREATE PROCEDURE create_date_index_if_not_exists()
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    DECLARE mysql_version VARCHAR(20);
    DECLARE major_version INT;
    DECLARE supports_functional_index INT;
    
    -- 获取MySQL版本
    SELECT VERSION() INTO mysql_version;
    SET major_version = CAST(SUBSTRING_INDEX(mysql_version, '.', 1) AS UNSIGNED);
    SET supports_functional_index = IF(major_version >= 8, 1, 0);
    
    -- 检查索引是否存在
    IF supports_functional_index = 1 THEN
        SELECT COUNT(*) INTO index_exists
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
            AND table_name = 'events'
            AND index_name = 'idx_date';
        
        IF index_exists = 0 THEN
            SET @sql = 'CREATE INDEX idx_date ON events((DATE(timestamp)))';
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            SELECT '索引 idx_date 创建成功' AS result;
        ELSE
            SELECT '索引 idx_date 已存在，跳过' AS result;
        END IF;
    ELSE
        SELECT COUNT(*) INTO index_exists
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
            AND table_name = 'events'
            AND index_name = 'idx_timestamp';
        
        IF index_exists = 0 THEN
            SET @sql = 'CREATE INDEX idx_timestamp ON events(timestamp)';
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            SELECT '索引 idx_timestamp 创建成功' AS result;
        ELSE
            SELECT '索引 idx_timestamp 已存在，跳过' AS result;
        END IF;
    END IF;
END$$

DELIMITER ;

-- 执行创建日期索引
CALL create_date_index_if_not_exists();
DROP PROCEDURE IF EXISTS create_date_index_if_not_exists;

-- 5. 清理存储过程
DROP PROCEDURE IF EXISTS create_index_if_not_exists;

-- 7. 查看索引使用情况
-- 运行查询后，使用 EXPLAIN 查看是否使用了索引
-- EXPLAIN SELECT * FROM events WHERE project_id = 'xxx' AND DATE(timestamp) = '2024-01-01';

-- 8. 分析表（更新统计信息，帮助优化器选择最佳索引）
ANALYZE TABLE events;

-- 9. 查看表大小和索引大小
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    ROUND((data_length / 1024 / 1024), 2) AS 'Data (MB)',
    ROUND((index_length / 1024 / 1024), 2) AS 'Index (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'sdk-platform'
    AND table_name = 'events';

