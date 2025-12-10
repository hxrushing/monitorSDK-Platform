-- 数据库索引优化脚本（简化版）
-- 用于提升百万级数据查询性能
-- 如果索引已存在，会报错但可以忽略

USE `sdk-platform`;

-- 1. 检查现有索引
SHOW INDEX FROM events;

-- 2. 创建复合索引（project_id + timestamp）- 最常用的查询组合
-- 如果已存在会报错，可以忽略
CREATE INDEX idx_project_timestamp ON events(project_id, timestamp);

-- 3. 创建复合索引（project_id + event_name）- 用于事件分析
CREATE INDEX idx_project_event ON events(project_id, event_name);

-- 4. 创建用户ID索引（用于UV统计）
CREATE INDEX idx_user_id ON events(user_id);

-- 5. 创建复合索引（project_id + user_id + timestamp）- 用于用户行为分析
CREATE INDEX idx_project_user_timestamp ON events(project_id, user_id, timestamp);

-- 6. 创建时间戳索引（用于日期查询）
-- MySQL 8.0+ 支持函数索引，可以使用 DATE(timestamp)
-- MySQL 5.7 及以下版本使用普通索引
CREATE INDEX idx_timestamp ON events(timestamp);

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

