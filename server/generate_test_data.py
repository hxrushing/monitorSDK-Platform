"""
生成过去14天的测试数据SQL脚本
用于时序预测功能测试
"""
import random
from datetime import datetime, timedelta

# 配置
PROJECT_ID = 'demo-project'  # 修改为您的项目ID
DAYS = 14  # 生成14天的数据

# 页面列表
PAGES = ['/home', '/products', '/product/detail', '/cart', '/checkout', 
         '/user/profile', '/search', '/category', '/about']

# 设备信息模板
DEVICES = [
    {
        'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'platform': 'Windows',
        'language': 'zh-CN',
        'screenResolution': '1920x1080'
    },
    {
        'userAgent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'platform': 'iOS',
        'language': 'zh-CN',
        'screenResolution': '375x667'
    },
    {
        'userAgent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
        'platform': 'Android',
        'language': 'zh-CN',
        'screenResolution': '360x640'
    }
]

def generate_sql():
    """生成SQL插入语句"""
    sql_statements = []
    sql_statements.append("-- 生成过去14天的测试数据")
    sql_statements.append(f"USE `sdk-platform`;")
    sql_statements.append(f"SET @project_id = '{PROJECT_ID}';")
    sql_statements.append("")
    sql_statements.append("INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp) VALUES")
    
    base_date = datetime.now() - timedelta(days=1)  # 从昨天开始
    
    all_values = []
    
    for day_offset in range(DAYS):
        current_date = base_date - timedelta(days=day_offset)
        is_weekend = current_date.weekday() >= 5  # 周六、周日
        
        # 计算当天的PV和UV（有增长趋势）
        # 基础值：第1天PV=800，每天增长约3%，周末减少20%
        base_pv = 800 + (DAYS - day_offset - 1) * 25 + random.randint(-50, 50)
        if is_weekend:
            base_pv = int(base_pv * 0.8)
        
        # UV约为PV的45-55%
        base_uv = int(base_pv * (0.45 + random.random() * 0.1))
        
        # 添加随机波动（±15%）
        day_pv = int(base_pv * (0.85 + random.random() * 0.3))
        day_uv = int(base_uv * (0.85 + random.random() * 0.3))
        
        # 确保最小值
        day_pv = max(day_pv, 300)
        day_uv = max(day_uv, 150)
        
        # 生成用户ID列表
        user_ids = [f'user-{i+1}' for i in range(day_uv)]
        
        # 在一天内分布事件（8:00-23:00）
        hour_distribution = {
            # 高峰时段（10-12点，19-21点）
            (10, 12): 0.10,  # 10%的事件
            (19, 21): 0.12,  # 12%的事件
            # 正常时段
            (8, 10): 0.06,
            (12, 19): 0.08,
            (21, 23): 0.05
        }
        
        events_generated = 0
        target_events = day_pv
        
        for hour in range(8, 23):
            # 计算当前小时应该生成的事件数
            hour_weight = 0.03  # 默认权重
            for (start, end), weight in hour_distribution.items():
                if start <= hour < end:
                    hour_weight = weight / (end - start)
                    break
            
            hour_events = max(1, int(target_events * hour_weight * (0.8 + random.random() * 0.4)))
            
            for _ in range(hour_events):
                if events_generated >= target_events:
                    break
                
                # 随机选择用户
                user_id = random.choice(user_ids)
                
                # 随机时间（当前小时内）
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                event_time = current_date.replace(hour=hour, minute=minute, second=second, microsecond=0)
                
                # 随机页面
                page = random.choice(PAGES)
                
                # 随机设备
                device = random.choice(DEVICES)
                
                # 生成SQL值
                event_params = f'{{"page": "{page}", "title": "页面-{page}"}}'
                device_info = (
                    f'{{"userAgent": "{device["userAgent"]}", '
                    f'"platform": "{device["platform"]}", '
                    f'"language": "{device["language"]}", '
                    f'"screenResolution": "{device["screenResolution"]}"}}'
                )
                timestamp = event_time.strftime('%Y-%m-%d %H:%M:%S')
                
                value = (
                    f"('{PROJECT_ID}', 'pageview', '{event_params}', "
                    f"'{user_id}', '{device_info}', '{timestamp}')"
                )
                all_values.append(value)
                
                events_generated += 1
            
            if events_generated >= target_events:
                break
    
    # 组合所有SQL语句
    for i, value in enumerate(all_values):
        if i == len(all_values) - 1:
            sql_statements.append(f"    {value};")
        else:
            sql_statements.append(f"    {value},")
    
    sql_statements.append("")
    sql_statements.append("-- 查看生成的数据统计")
    sql_statements.append("SELECT ")
    sql_statements.append("    DATE(timestamp) as date,")
    sql_statements.append("    COUNT(*) as pv,")
    sql_statements.append("    COUNT(DISTINCT user_id) as uv,")
    sql_statements.append("    ROUND(COUNT(DISTINCT user_id) / COUNT(*) * 100, 2) as conversion_rate_percent")
    sql_statements.append("FROM events")
    sql_statements.append(f"WHERE project_id = '{PROJECT_ID}'")
    sql_statements.append("    AND timestamp >= DATE_SUB(NOW(), INTERVAL 14 DAY)")
    sql_statements.append("    AND event_name = 'pageview'")
    sql_statements.append("GROUP BY DATE(timestamp)")
    sql_statements.append("ORDER BY date ASC;")
    
    return '\n'.join(sql_statements)

if __name__ == '__main__':
    sql = generate_sql()
    
    # 输出到文件
    with open('generated_test_data.sql', 'w', encoding='utf-8') as f:
        f.write(sql)
    
    print("SQL脚本已生成: generated_test_data.sql")
    print(f"预计生成约 {DAYS * 800} 条事件数据")
    print("\n使用说明：")
    print("1. 修改脚本中的 PROJECT_ID 为您的项目ID")
    print("2. 运行: python generate_test_data.py")
    print("3. 执行生成的SQL文件: generated_test_data.sql")

