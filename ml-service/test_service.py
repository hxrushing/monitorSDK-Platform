"""
测试ML预测服务是否正常运行
"""
import requests
import json

def test_health():
    """测试健康检查接口"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            print("✅ ML服务运行正常")
            print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"❌ ML服务响应异常，状态码: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到ML服务")
        print("请确保服务已启动: python app.py")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_predict():
    """测试预测接口（使用示例数据）"""
    try:
        # 生成示例历史数据（30天）
        import datetime
        historical_data = []
        base_date = datetime.datetime.now() - datetime.timedelta(days=30)
        for i in range(30):
            date = base_date + datetime.timedelta(days=i)
            historical_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "pv": 1000 + i * 10 + (i % 7) * 50,  # 模拟有周期性的数据
                "uv": 500 + i * 5 + (i % 7) * 25
            })
        
        payload = {
            "projectId": "test-project",
            "metricType": "pv",
            "modelType": "lstm",
            "days": 7,
            "historicalData": historical_data
        }
        
        print("\n正在测试预测接口...")
        response = requests.post(
            'http://localhost:5000/predict',
            json=payload,
            timeout=30  # 预测可能需要一些时间
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ 预测接口测试成功")
                print(f"预测结果数量: {len(result.get('predictions', []))}")
                print(f"模型类型: {result.get('modelType')}")
                return True
            else:
                print(f"❌ 预测失败: {result.get('error')}")
                return False
        else:
            print(f"❌ 预测接口响应异常，状态码: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 预测测试失败: {e}")
        return False

if __name__ == '__main__':
    print("=" * 50)
    print("ML预测服务测试")
    print("=" * 50)
    
    # 测试健康检查
    if test_health():
        # 如果健康检查通过，测试预测功能
        test_predict()
    
    print("=" * 50)



