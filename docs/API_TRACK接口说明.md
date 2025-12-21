# `/api/track` 接口说明

## 📍 接口位置

### 路由定义
**文件**: `server/src/routes/api.ts`  
**行数**: 第137-182行

```typescript
// 事件追踪接口（不需要认证，因为SDK可能没有token）
router.post('/track', async (req, res) => {
  // 处理批量事件或单个事件
  // 支持新旧两种数据格式
});
```

### 服务实现
**文件**: `server/src/services/trackingService.ts`  
**主要方法**:
- `trackBatchEvents()` - 批量事件处理（第70行）
- `trackEvent()` - 单个事件处理（第153行）

**重要更新**: 后端已更新以同时支持新旧两种数据格式：
- 新格式：`eventType` + `payload` + `ts`
- 旧格式：`eventName` + `eventParams` + `timestamp`

### 路由注册
**文件**: `server/src/app.ts`  
**行数**: 第94行

```typescript
app.use('/api', createApiRouter(db, summaryService));
```

所以完整的URL路径是：`http://localhost:3000/api/track`

## 📊 数据流程

### 1. 接收请求
接口接收POST请求，支持两种格式：

#### 批量事件格式（新SDK使用）
```json
{
  "projectId": "demo-project",
  "events": [
    {
      "projectId": "demo-project",
      "eventType": "test_event",
      "payload": {...},
      "ts": 1234567890,
      "device": {...},
      "sdkVersion": "1.0.0"
    }
  ],
  "batchSize": 1,
  "timestamp": 1234567890,
  "uid": "user_123",
  "deviceInfo": {...},
  "sdkVersion": "1.0.0"
}
```

#### 单个事件格式（向后兼容）
```json
{
  "projectId": "demo-project",
  "eventName": "test_event",
  "eventParams": {...},
  "uid": "user_123",
  "deviceInfo": {...},
  "timestamp": 1234567890
}
```

### 2. 数据处理
1. 检查是否是批量事件（检查 `events` 字段）
2. 如果是批量事件，调用 `trackBatchEvents()`
3. 如果是单个事件，调用 `trackEvent()`

### 3. 数据存储

#### 数据库表：`events`
数据存储在MySQL数据库的 `events` 表中：

```sql
CREATE TABLE events (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_params JSON,
  user_id VARCHAR(255),
  device_info JSON,
  timestamp DATETIME NOT NULL,
  INDEX idx_project_event (project_id, event_name),
  INDEX idx_timestamp (timestamp)
);
```

#### 数据映射
- `project_id` ← `projectId`
- `event_name` ← `eventType`（新格式）或 `eventName`（旧格式）
- `event_params` ← `payload`（新格式）或 `eventParams`（旧格式），转为JSON字符串
- `user_id` ← `uid`
- `device_info` ← `deviceInfo`，转为JSON字符串
- `timestamp` ← `ts`（新格式）或 `timestamp`（旧格式）

## 🔍 如何验证接口是否工作

### 1. 检查后端服务是否运行
```bash
# 进入server目录
cd server

# 启动服务（如果还没启动）
npm start
# 或
npm run dev
```

服务应该监听在 `http://localhost:3000`

### 2. 查看后端日志
在服务启动的终端中，你会看到类似这样的日志：
```
开始处理事件追踪: { projectId: 'demo-project', ... }
插入事件数据: [...]
事件追踪完成
```

### 3. 检查数据库
```sql
-- 查看最近的事件
SELECT * FROM events 
WHERE project_id = 'demo-project' 
ORDER BY timestamp DESC 
LIMIT 10;

-- 统计事件数量
SELECT event_name, COUNT(*) as count 
FROM events 
WHERE project_id = 'demo-project' 
GROUP BY event_name;
```

### 4. 使用curl测试接口
```bash
curl -X POST http://localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo-project",
    "eventType": "test_event",
    "payload": {"test": true},
    "ts": 1234567890,
    "device": {
      "userAgent": "test",
      "platform": "test",
      "language": "zh-CN",
      "screenResolution": "1920x1080"
    },
    "sdkVersion": "1.0.0"
  }'
```

### 5. 在前端测试页面中查看
1. 打开浏览器开发者工具
2. 切换到 **Network（网络）** 面板
3. 过滤关键字：`track`
4. 点击测试页面的"测试 track()"按钮
5. 点击"测试 flush()"按钮立即发送
6. 查看Network面板中的请求：
   - 请求URL: `http://localhost:3000/api/track`
   - 请求方法: `POST`
   - 状态码: `200`（成功）或其他（失败）
   - 请求体: 查看Payload标签页
   - 响应: 查看Response标签页

## ⚠️ 常见问题

### 1. CORS错误
如果看到CORS错误，检查 `server/src/app.ts` 中的CORS配置是否正确。

### 2. 数据库连接错误
- 检查 `.env` 文件中的数据库配置
- 确认MySQL服务正在运行
- 确认数据库和表已创建

### 3. 404错误
- 确认后端服务正在运行
- 确认端口是3000（检查 `server/src/app.ts` 中的 `PORT` 配置）
- 确认URL路径正确：`/api/track`

### 4. 500错误
查看后端终端日志，通常会显示具体的错误信息，如：
- 数据库表不存在
- 数据库连接失败
- 字段验证失败

## 📝 注意事项

1. **无需认证**: `/api/track` 接口不需要Token认证，因为SDK可能没有token
2. **自动创建事件定义**: 如果事件定义不存在，会自动创建
3. **批量处理**: 新SDK使用批量格式，可以提高性能
4. **错误处理**: 接口会返回详细的错误信息，包括数据库错误码

