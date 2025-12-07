-- ============================================
-- 生成过去14天的测试数据用于时序预测
-- ============================================
-- 使用说明：
-- 1. 确保已有一个项目ID（默认使用 'demo-project'）
-- 2. 执行此SQL脚本生成测试数据
-- 3. 数据包含合理的趋势和随机性，适合用于预测

USE `sdk-platform`;

-- 设置变量
SET @project_id = 'demo-project';  -- 修改为您的项目ID
SET @base_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY);  -- 从昨天开始往前14天

-- 清空现有测试数据（可选，取消注释以清空）
-- DELETE FROM events WHERE project_id = @project_id AND timestamp >= DATE_SUB(@base_date, INTERVAL 13 DAY);

-- ============================================
-- 生成过去14天的数据
-- ============================================
-- 数据特点：
-- 1. 整体呈上升趋势（模拟业务增长）
-- 2. 周末数据相对较少（模拟真实场景）
-- 3. 每天有多个时间点的数据
-- 4. UV/PV比例合理（约40-60%）
-- 5. 包含随机波动

-- 生成数据的存储过程
DELIMITER $$

DROP PROCEDURE IF EXISTS generate_test_events$$

CREATE PROCEDURE generate_test_events()
BEGIN
    DECLARE day_offset INT DEFAULT 13;
    DECLARE current_date DATE;
    DECLARE day_pv INT;
    DECLARE day_uv INT;
    DECLARE hour_offset INT;
    DECLARE event_count INT;
    DECLARE user_index INT;
    DECLARE user_id VARCHAR(100);
    DECLARE is_weekend BOOLEAN;
    DECLARE base_pv INT;
    DECLARE base_uv INT;
    
    -- 循环生成14天的数据
    WHILE day_offset >= 0 DO
        SET current_date = DATE_SUB(@base_date, INTERVAL day_offset DAY);
        SET is_weekend = (DAYOFWEEK(current_date) IN (1, 7));  -- 1=周日, 7=周六
        
        -- 计算基础PV和UV（有增长趋势 + 周末效应）
        -- 基础值：第1天PV=800，每天增长约3%，周末减少20%
        SET base_pv = 800 + (13 - day_offset) * 25 + FLOOR(RAND() * 100) - 50;
        IF is_weekend THEN
            SET base_pv = FLOOR(base_pv * 0.8);
        END IF;
        
        -- UV约为PV的45-55%
        SET base_uv = FLOOR(base_pv * (0.45 + RAND() * 0.1));
        
        -- 添加随机波动（±15%）
        SET day_pv = FLOOR(base_pv * (0.85 + RAND() * 0.3));
        SET day_uv = FLOOR(base_uv * (0.85 + RAND() * 0.3));
        
        -- 确保最小值
        SET day_pv = GREATEST(day_pv, 300);
        SET day_uv = GREATEST(day_uv, 150);
        
        -- 生成当天的用户列表
        SET user_index = 0;
        
        -- 在一天内分布事件（8:00-23:00，高峰在10:00-12:00和19:00-21:00）
        SET hour_offset = 8;
        WHILE hour_offset < 24 DO
            -- 计算当前小时的事件数量（基于时间分布）
            SET event_count = 0;
            
            -- 高峰时段（10-12点，19-21点）事件较多
            IF (hour_offset >= 10 AND hour_offset < 12) OR (hour_offset >= 19 AND hour_offset < 21) THEN
                SET event_count = FLOOR(day_pv * (0.08 + RAND() * 0.04));
            -- 正常时段（8-10点，12-19点，21-23点）
            ELSEIF hour_offset >= 8 AND hour_offset < 23 THEN
                SET event_count = FLOOR(day_pv * (0.03 + RAND() * 0.03));
            END IF;
            
            -- 确保每小时至少有少量事件
            SET event_count = GREATEST(event_count, FLOOR(day_pv / 100));
            
            -- 生成当前小时的事件
            WHILE event_count > 0 DO
                -- 随机选择用户（确保UV合理）
                IF RAND() < (day_uv / day_pv) THEN
                    -- 新用户或已有用户
                    SET user_id = CONCAT('user-', FLOOR(1 + RAND() * day_uv));
                ELSE
                    -- 重复访问的用户
                    SET user_id = CONCAT('user-', FLOOR(1 + RAND() * day_uv));
                END IF;
                
                -- 随机分钟和秒
                SET @event_time = CONCAT(
                    current_date, ' ',
                    LPAD(hour_offset, 2, '0'), ':',
                    LPAD(FLOOR(RAND() * 60), 2, '0'), ':',
                    LPAD(FLOOR(RAND() * 60), 2, '0')
                );
                
                -- 随机页面路径
                SET @page_path = CASE FLOOR(RAND() * 10)
                    WHEN 0 THEN '/home'
                    WHEN 1 THEN '/products'
                    WHEN 2 THEN '/product/detail'
                    WHEN 3 THEN '/cart'
                    WHEN 4 THEN '/checkout'
                    WHEN 5 THEN '/user/profile'
                    WHEN 6 THEN '/search'
                    WHEN 7 THEN '/category'
                    WHEN 8 THEN '/about'
                    ELSE '/home'
                END;
                
                -- 随机设备信息
                SET @device_info = CASE FLOOR(RAND() * 3)
                    WHEN 0 THEN '{"userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}'
                    WHEN 1 THEN '{"userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}'
                    ELSE '{"userAgent": "Mozilla/5.0 (Android 10; Mobile)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}'
                END;
                
                -- 插入pageview事件
                INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp)
                VALUES (
                    @project_id,
                    'pageview',
                    JSON_OBJECT('page', @page_path, 'title', CONCAT('页面-', @page_path)),
                    user_id,
                    JSON_OBJECT(
                        'userAgent', JSON_EXTRACT(@device_info, '$.userAgent'),
                        'platform', JSON_EXTRACT(@device_info, '$.platform'),
                        'language', JSON_EXTRACT(@device_info, '$.language'),
                        'screenResolution', JSON_EXTRACT(@device_info, '$.screenResolution')
                    ),
                    @event_time
                );
                
                SET event_count = event_count - 1;
            END WHILE;
            
            SET hour_offset = hour_offset + 1;
        END WHILE;
        
        SET day_offset = day_offset - 1;
    END WHILE;
    
    SELECT CONCAT('成功生成过去14天的测试数据，项目ID: ', @project_id) AS result;
END$$

DELIMITER ;

-- 执行存储过程生成数据
CALL generate_test_events();

-- 删除存储过程（可选）
DROP PROCEDURE IF EXISTS generate_test_events;

-- 查看生成的数据统计
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as pv,
    COUNT(DISTINCT user_id) as uv,
    ROUND(COUNT(DISTINCT user_id) / COUNT(*) * 100, 2) as conversion_rate_percent
FROM events
WHERE project_id = @project_id
    AND timestamp >= DATE_SUB(@base_date, INTERVAL 13 DAY)
    AND event_name = 'pageview'
GROUP BY DATE(timestamp)
ORDER BY date ASC;

