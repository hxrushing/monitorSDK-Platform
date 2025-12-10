"""
数据库连接测试脚本
用于诊断数据库连接问题
"""
import sys

def test_connection():
    """测试数据库连接"""
    print("=" * 50)
    print("数据库连接诊断工具")
    print("=" * 50)
    
    # 1. 检查mysql-connector-python是否安装
    print("\n1. 检查依赖...")
    try:
        import mysql.connector
        from mysql.connector import pooling
        print("✅ mysql-connector-python 已安装")
    except ImportError:
        print("❌ mysql-connector-python 未安装")
        print("   请运行: pip install mysql-connector-python")
        return False
    
    # 2. 读取配置
    print("\n2. 读取数据库配置...")
    DB_CONFIG = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': 'chx200466',
        'database': 'sdk-platform',
        'charset': 'utf8mb4',
    }
    
    print(f"   主机: {DB_CONFIG['host']}")
    print(f"   用户: {DB_CONFIG['user']}")
    print(f"   数据库: {DB_CONFIG['database']}")
    print(f"   密码: {'*' * len(DB_CONFIG['password'])}")
    
    # 3. 测试基本连接
    print("\n3. 测试基本连接...")
    try:
        conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            connection_timeout=5
        )
        print("✅ 基本连接成功")
        conn.close()
    except mysql.connector.Error as e:
        print(f"❌ 基本连接失败: {e}")
        print("\n可能的原因：")
        print("  1. MySQL服务未启动")
        print("  2. 用户名或密码错误")
        print("  3. 主机地址不正确")
        print("  4. 防火墙阻止连接")
        return False
    
    # 4. 测试数据库是否存在
    print("\n4. 测试数据库是否存在...")
    try:
        conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            connection_timeout=5
        )
        print(f"✅ 数据库 '{DB_CONFIG['database']}' 连接成功")
        
        # 检查表是否存在
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES LIKE 'events'")
        if cursor.fetchone():
            print("✅ events 表存在")
            
            # 检查表结构
            cursor.execute("DESCRIBE events")
            columns = cursor.fetchall()
            print(f"   表结构: {len(columns)} 个字段")
        else:
            print("⚠️  events 表不存在，可能需要初始化数据库")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as e:
        print(f"❌ 数据库连接失败: {e}")
        print("\n可能的原因：")
        if e.errno == 1049:
            print("  数据库不存在，请先创建数据库")
            print(f"  运行: CREATE DATABASE `{DB_CONFIG['database']}`;")
        elif e.errno == 1045:
            print("  用户名或密码错误")
        elif e.errno == 2003:
            print("  无法连接到MySQL服务器")
            print("  请检查MySQL服务是否启动")
        else:
            print(f"  错误代码: {e.errno}")
            print(f"  错误信息: {e.msg}")
        return False
    
    # 5. 测试连接池
    print("\n5. 测试连接池...")
    try:
        pool_config = {
            **DB_CONFIG,
            'pool_size': 5,
            'pool_reset_session': False
        }
        connection_pool = pooling.MySQLConnectionPool(**pool_config)
        print("✅ 连接池创建成功")
        
        # 测试从连接池获取连接
        conn = connection_pool.get_connection()
        print("✅ 从连接池获取连接成功")
        conn.close()
    except Exception as e:
        print(f"❌ 连接池测试失败: {e}")
        return False
    
    # 6. 测试插入操作
    print("\n6. 测试插入操作...")
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 先检查或创建测试项目（因为外键约束）
        test_project_id = 'test-connection'
        cursor.execute("SELECT id FROM projects WHERE id = %s", (test_project_id,))
        if not cursor.fetchone():
            print(f"   创建测试项目: {test_project_id}")
            cursor.execute(
                "INSERT INTO projects (id, name, description) VALUES (%s, %s, %s)",
                (test_project_id, '测试项目', '用于连接测试的临时项目')
            )
            conn.commit()
            print("   ✅ 测试项目创建成功")
        else:
            print(f"   ✅ 测试项目已存在: {test_project_id}")
        
        # 测试插入（使用测试项目ID）
        test_sql = """
        INSERT INTO events 
        (project_id, event_name, event_params, user_id, device_info, timestamp) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        test_data = (
            test_project_id,
            'test_event',
            '{}',
            'test-user',
            '{}',
            '2024-01-01 00:00:00'
        )
        
        cursor.execute(test_sql, test_data)
        conn.commit()
        print("✅ 插入操作成功")
        
        # 删除测试数据
        cursor.execute("DELETE FROM events WHERE project_id = %s", (test_project_id,))
        cursor.execute("DELETE FROM projects WHERE id = %s", (test_project_id,))
        conn.commit()
        print("✅ 清理测试数据成功")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as e:
        print(f"❌ 插入操作失败: {e}")
        print(f"   错误代码: {e.errno}")
        if e.errno == 1452:
            print("\n   原因：外键约束失败")
            print("   events 表的 project_id 必须引用 projects 表中存在的项目")
            print("   解决方法：")
            print("     1. 先创建项目，再插入事件")
            print("     2. 或使用已存在的项目ID")
        else:
            print("\n可能的原因：")
            print("  1. 表结构不匹配")
            print("  2. 字段类型错误")
            print("  3. 权限不足")
        return False
    except Exception as e:
        print(f"❌ 插入操作失败: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ 所有测试通过！数据库连接正常")
    print("=" * 50)
    return True

if __name__ == '__main__':
    success = test_connection()
    sys.exit(0 if success else 1)

