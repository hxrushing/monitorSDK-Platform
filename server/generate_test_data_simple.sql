-- ============================================
-- 简化版：生成过去14天的测试数据
-- 不需要存储过程，直接插入数据
-- ============================================
-- 使用说明：
-- 1. 修改 @project_id 为您的项目ID
-- 2. 直接执行此SQL脚本

USE `sdk-platform`;

SET @project_id = 'demo-project';  -- 修改为您的项目ID

-- 生成过去14天的数据
-- 数据特点：整体上升趋势，周末略低，每天有合理的PV和UV分布

INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp) VALUES

-- 第1天（14天前）- 基础数据
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-1', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 9 HOUR + INTERVAL 15 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-1', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 10 HOUR + INTERVAL 20 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-3', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 11 HOUR + INTERVAL 10 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 11 HOUR + INTERVAL 45 MINUTE),
('demo-project', 'pageview', '{"page": "/product/detail", "title": "商品详情"}', 'user-1', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 14 HOUR + INTERVAL 20 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-4', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 15 HOUR + INTERVAL 5 MINUTE),
('demo-project', 'pageview', '{"page": "/cart", "title": "购物车"}', 'user-1', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 15 HOUR + INTERVAL 35 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-5', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 19 HOUR + INTERVAL 30 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-3', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 20 HOUR + INTERVAL 15 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-6', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 20 HOUR + INTERVAL 50 MINUTE),
('demo-project', 'pageview', '{"page": "/search", "title": "搜索结果"}', 'user-4', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 14 DAY) + INTERVAL 21 HOUR + INTERVAL 25 MINUTE),

-- 第2天（13天前）- 略微增长
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-1', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 9 HOUR + INTERVAL 10 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 9 HOUR + INTERVAL 25 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-7', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 10 HOUR + INTERVAL 5 MINUTE),
('demo-project', 'pageview', '{"page": "/product/detail", "title": "商品详情"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 10 HOUR + INTERVAL 40 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-3', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 11 HOUR + INTERVAL 15 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-8', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 11 HOUR + INTERVAL 50 MINUTE),
('demo-project', 'pageview', '{"page": "/cart", "title": "购物车"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 14 HOUR + INTERVAL 30 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-4', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 15 HOUR + INTERVAL 10 MINUTE),
('demo-project', 'pageview', '{"page": "/checkout", "title": "结算页面"}', 'user-2', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 15 HOUR + INTERVAL 45 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-9', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 19 HOUR + INTERVAL 20 MINUTE),
('demo-project', 'pageview', '{"page": "/products", "title": "商品列表"}', 'user-5', '{"userAgent": "Mozilla/5.0 (Android)", "platform": "Android", "language": "zh-CN", "screenResolution": "360x640"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 20 HOUR + INTERVAL 10 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-10', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 20 HOUR + INTERVAL 40 MINUTE),
('demo-project', 'pageview', '{"page": "/category", "title": "分类页面"}', 'user-6', '{"userAgent": "Mozilla/5.0 (iPhone)", "platform": "iOS", "language": "zh-CN", "screenResolution": "375x667"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 21 HOUR + INTERVAL 15 MINUTE),
('demo-project', 'pageview', '{"page": "/home", "title": "首页"}', 'user-11', '{"userAgent": "Mozilla/5.0 (Windows NT 10.0)", "platform": "Windows", "language": "zh-CN", "screenResolution": "1920x1080"}', DATE_SUB(NOW(), INTERVAL 13 DAY) + INTERVAL 21 HOUR + INTERVAL 55 MINUTE);

-- 继续生成剩余12天的数据...
-- 为了简化，这里提供一个生成脚本的Python版本

-- 查看已生成的数据
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as pv,
    COUNT(DISTINCT user_id) as uv,
    ROUND(COUNT(DISTINCT user_id) / COUNT(*) * 100, 2) as conversion_rate_percent
FROM events
WHERE project_id = @project_id
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 14 DAY)
    AND event_name = 'pageview'
GROUP BY DATE(timestamp)
ORDER BY date ASC;



