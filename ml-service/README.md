# 时序预测服务

使用LSTM和GRU模型预测PV、UV、转化率等指标的时序预测服务。

## 功能特性

- ✅ 支持LSTM和GRU两种深度学习模型
- ✅ 预测未来1-7天的PV、UV、转化率等指标
- ✅ 自动数据归一化和预处理
- ✅ 批量预测多个指标
- ✅ 如果TensorFlow不可用，自动降级到线性回归

## 安装依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

## 配置

创建 `.env` 文件：

```env
ML_SERVICE_PORT=5000
FLASK_DEBUG=False
```

## 运行服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## API接口

### 健康检查

```bash
GET /health
```

### 单指标预测

```bash
POST /predict
Content-Type: application/json

{
  "projectId": "project-123",
  "metricType": "pv",  // pv, uv, conversion_rate
  "modelType": "lstm",  // lstm, gru
  "days": 7,
  "historicalData": [
    {"date": "2024-01-01", "pv": 1000, "uv": 500},
    {"date": "2024-01-02", "pv": 1200, "uv": 600},
    ...
  ]
}
```

### 批量预测

```bash
POST /predict/batch
Content-Type: application/json

{
  "projectId": "project-123",
  "metrics": ["pv", "uv", "conversion_rate"],
  "modelType": "lstm",
  "days": 7,
  "historicalData": [...]
}
```

## 注意事项

1. **数据要求**：至少需要14天的历史数据才能进行预测
2. **TensorFlow**：如果未安装TensorFlow，将自动使用线性回归作为备选方案
3. **性能**：首次预测需要训练模型，可能需要几秒钟时间



















