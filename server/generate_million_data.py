"""
生成百万级测试数据
用于性能测试
包含页面浏览事件，用于测试事件分析页面
"""
import random
import json
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
try:
    import mysql.connector
    from mysql.connector import pooling
except ImportError:
    print("请先安装 mysql-connector-python: pip install mysql-connector-python")
    exit(1)

# 配置
PROJECT_ID = 'perf-test-project'
TOTAL_EVENTS = 1000000  # 100万条数据
BATCH_SIZE = 10000  # 每批插入1万条
DAYS = 30  # 生成30天的数据
THREADS = 4  # 并发线程数

# 页面浏览事件占比（用于测试事件分析页面）
PAGE_VIEW_RATIO = 0.4  # 40% 的事件是页面浏览

# 数据库配置（请修改为您的配置）
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': 'chx200466',  # 修改为您的密码
    'database': 'sdk-platform',
    'charset': 'utf8mb4',
    'pool_size': 10,
    'pool_reset_session': False
}

# 事件类型
EVENT_TYPES = [
    'page_view', 'click', 'scroll', 'form_submit', 
    'purchase', 'add_to_cart', 'search', 'share'
]

# 页面列表
PAGES = [
    '/home', '/products', '/product/detail', '/cart', 
    '/checkout', '/user/profile', '/search', '/category'
]

def generate_event(project_id, start_date, day_offset, force_page_view=False):
    """生成单个事件"""
    current_date = start_date - timedelta(days=day_offset)
    
    # 随机时间（0-23点）
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    event_time = current_date.replace(hour=hour, minute=minute, second=second)
    
    # 随机用户ID
    user_id = f'user-{random.randint(1, 100000)}'
    
    # 事件类型：优先生成页面浏览事件（用于测试事件分析页面）
    if force_page_view or random.random() < PAGE_VIEW_RATIO:
        event_name = 'page_view'
    else:
        event_name = random.choice([e for e in EVENT_TYPES if e != 'page_view'])
    
    # 随机页面
    page = random.choice(PAGES)
    
    # 事件参数
    event_params = {
        'page': page,
        'title': f'页面-{page}',
        'referrer': random.choice(['direct', 'google', 'baidu', 'weibo']),
        'duration': random.randint(1, 300)  # 停留时间（秒）
    }
    
    # 设备信息
    device_info = {
        'userAgent': random.choice([
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
            'Mozilla/5.0 (Linux; Android 10)'
        ]),
        'platform': random.choice(['Windows', 'iOS', 'Android']),
        'language': 'zh-CN',
        'screenResolution': random.choice(['1920x1080', '375x667', '360x640'])
    }
    
    return (
        project_id,
        event_name,
        json.dumps(event_params, ensure_ascii=False),
        user_id,
        json.dumps(device_info, ensure_ascii=False),
        event_time.strftime('%Y-%m-%d %H:%M:%S')
    )

def insert_batch(connection_pool, events):
    """批量插入事件"""
    try:
        conn = connection_pool.get_connection()
        cursor = conn.cursor()
        
        sql = """
        INSERT INTO events 
        (project_id, event_name, event_params, user_id, device_info, timestamp) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(sql, events)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return len(events)
    except Exception as e:
        print(f'批量插入失败: {e}')
        return 0

def create_event_definitions(cursor, conn, project_id):
    """创建事件定义（用于事件分析页面）"""
    import uuid
    
    # 事件定义列表
    event_defs = [
        {
            'name': 'page_view',
            'description': '页面浏览',
            'params': {
                'page': 'string',
                'title': 'string',
                'referrer': 'string',
                'duration': 'number'
            }
        },
        {
            'name': 'click',
            'description': '点击事件',
            'params': {
                'element': 'string',
                'text': 'string'
            }
        },
        {
            'name': 'scroll',
            'description': '滚动事件',
            'params': {
                'scrollTop': 'number',
                'scrollHeight': 'number'
            }
        },
        {
            'name': 'form_submit',
            'description': '表单提交',
            'params': {
                'formId': 'string',
                'fields': 'array'
            }
        },
        {
            'name': 'purchase',
            'description': '购买事件',
            'params': {
                'orderId': 'string',
                'amount': 'number',
                'items': 'array'
            }
        },
        {
            'name': 'add_to_cart',
            'description': '加入购物车',
            'params': {
                'productId': 'string',
                'quantity': 'number'
            }
        },
        {
            'name': 'search',
            'description': '搜索事件',
            'params': {
                'keyword': 'string',
                'results': 'number'
            }
        },
        {
            'name': 'share',
            'description': '分享事件',
            'params': {
                'platform': 'string',
                'content': 'string'
            }
        }
    ]
    
    created_count = 0
    for event_def in event_defs:
        try:
            event_id = str(uuid.uuid4())
            cursor.execute(
                """INSERT INTO event_definitions 
                   (id, project_id, event_name, description, params_schema) 
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE 
                   description = VALUES(description),
                   params_schema = VALUES(params_schema)""",
                (
                    event_id,
                    project_id,
                    event_def['name'],
                    event_def['description'],
                    json.dumps(event_def['params'], ensure_ascii=False)
                )
            )
            created_count += 1
        except Exception as e:
            print(f'⚠️  创建事件定义 "{event_def["name"]}" 失败: {e}')
    
    conn.commit()
    return created_count

def generate_million_data():
    """生成百万级数据"""
    print(f'开始生成 {TOTAL_EVENTS:,} 条测试数据...')
    print(f'项目ID: {PROJECT_ID}')
    print(f'时间范围: {DAYS} 天')
    print(f'批量大小: {BATCH_SIZE:,} 条/批')
    print(f'并发线程: {THREADS}')
    print(f'页面浏览事件占比: {PAGE_VIEW_RATIO*100:.0f}%')
    print('\n请确保已修改数据库配置（DB_CONFIG）')
    
    # 创建连接池
    try:
        # 先测试基本连接
        print('正在测试数据库连接...')
        test_conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            connection_timeout=5
        )
        
        # 检查项目是否存在（因为外键约束）
        cursor = test_conn.cursor()
        cursor.execute("SELECT id FROM projects WHERE id = %s", (PROJECT_ID,))
        if not cursor.fetchone():
            print(f'⚠️  项目 "{PROJECT_ID}" 不存在，正在创建...')
            cursor.execute(
                "INSERT INTO projects (id, name, description) VALUES (%s, %s, %s)",
                (PROJECT_ID, '性能测试项目', '用于百万级数据性能测试的项目')
            )
            test_conn.commit()
            print(f'✅ 项目 "{PROJECT_ID}" 创建成功')
        else:
            print(f'✅ 项目 "{PROJECT_ID}" 已存在')
        
        # 删除该项目的旧数据
        print(f'\n正在删除项目 "{PROJECT_ID}" 的旧数据...')
        cursor.execute("DELETE FROM events WHERE project_id = %s", (PROJECT_ID,))
        deleted_events = cursor.rowcount
        cursor.execute("DELETE FROM event_definitions WHERE project_id = %s", (PROJECT_ID,))
        deleted_defs = cursor.rowcount
        test_conn.commit()
        print(f'✅ 已删除 {deleted_events:,} 条事件数据')
        print(f'✅ 已删除 {deleted_defs} 条事件定义')
        
        # 创建事件定义（用于事件分析页面）
        print(f'\n正在创建事件定义...')
        created_defs = create_event_definitions(cursor, test_conn, PROJECT_ID)
        print(f'✅ 已创建 {created_defs} 个事件定义（包括 page_view）')
        
        cursor.close()
        test_conn.close()
        print('✅ 数据库连接测试成功')
        
        # 创建连接池
        connection_pool = pooling.MySQLConnectionPool(**DB_CONFIG)
        print('✅ 连接池创建成功')
    except mysql.connector.Error as e:
        print(f'\n❌ 数据库连接失败！')
        print(f'错误代码: {e.errno}')
        print(f'错误信息: {e.msg}')
        print('\n可能的原因：')
        if e.errno == 1045:
            print('  1. 用户名或密码错误')
            print('  2. 请检查 DB_CONFIG 中的 user 和 password')
        elif e.errno == 1049:
            print(f'  1. 数据库 "{DB_CONFIG["database"]}" 不存在')
            print('  2. 请先创建数据库或修改 database 配置')
            print(f'     运行: CREATE DATABASE `{DB_CONFIG["database"]}`;')
        elif e.errno == 2003:
            print('  1. 无法连接到MySQL服务器')
            print('  2. MySQL服务可能未启动')
            print('  3. 请检查 MySQL 服务状态')
            print('     Windows: net start MySQL 或 服务管理器')
            print('     Linux: sudo systemctl status mysql')
        elif e.errno == 2005:
            print('  1. 主机地址不正确')
            print(f'  2. 当前配置: host = {DB_CONFIG["host"]}')
            print('  3. 请检查 host 配置（localhost 或 127.0.0.1）')
        else:
            print(f'  未知错误，错误代码: {e.errno}')
        print('\n建议：')
        print('  1. 运行诊断脚本: python test_db_connection.py')
        print('  2. 检查 MySQL 服务是否启动')
        print('  3. 验证数据库配置是否正确')
        return
    except Exception as e:
        print(f'\n❌ 连接失败: {e}')
        print('请检查数据库配置（host, user, password, database）')
        return
    
    # 计算每天的数据量
    events_per_day = TOTAL_EVENTS // DAYS
    
    start_date = datetime.now()
    total_inserted = 0
    
    # 使用线程池并发生成
    with ThreadPoolExecutor(max_workers=THREADS) as executor:
        futures = []
        
        for day_offset in range(DAYS):
            # 生成当天的数据
            day_events = []
            for _ in range(events_per_day):
                event = generate_event(PROJECT_ID, start_date, day_offset)
                day_events.append(event)
                
                # 达到批量大小时插入
                if len(day_events) >= BATCH_SIZE:
                    future = executor.submit(insert_batch, connection_pool, day_events.copy())
                    futures.append(future)
                    day_events.clear()
            
            # 插入剩余数据
            if day_events:
                future = executor.submit(insert_batch, connection_pool, day_events)
                futures.append(future)
        
        # 等待所有任务完成
        for i, future in enumerate(futures):
            inserted = future.result()
            total_inserted += inserted
            if (i + 1) % 10 == 0:
                print(f'已完成 {i + 1}/{len(futures)} 批，已插入 {total_inserted:,} 条')
    
    print(f'\n数据生成完成！')
    print(f'总计插入: {total_inserted:,} 条')
    print(f'项目ID: {PROJECT_ID}')
    
    # 验证数据
    try:
        conn = connection_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT COUNT(*) FROM events WHERE project_id = %s',
            (PROJECT_ID,)
        )
        count = cursor.fetchone()[0]
        print(f'数据库实际记录数: {count:,} 条')
        cursor.close()
        conn.close()
    except Exception as e:
        print(f'验证数据失败: {e}')

if __name__ == '__main__':
    generate_million_data()


