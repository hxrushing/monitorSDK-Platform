# SSE 连接调试指南

## 问题排查步骤

### 1. 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签页，应该能看到以下日志：

**成功连接时：**
```
[SSE] 连接 URL: http://localhost:3000/api/ai-summary/progress/xxx/stream?token=***
[SSE] 连接已建立
[SSE] 收到消息: {"success":true,"data":{...}}
[SSE] 进度更新: pending 0%
```

**连接失败时：**
```
[SSE] 连接错误: ...
[SSE] EventSource readyState: 2
```

### 2. 检查网络请求

在浏览器开发者工具的 Network 标签页中：

1. 找到类型为 `eventsource` 的请求
2. 检查请求 URL 是否正确
3. 检查响应状态码（应该是 200）
4. 检查响应头：
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`

### 3. 检查后端日志

在后端服务器终端中，应该能看到：

```
[SSE] 收到连接请求，taskId: xxx
[SSE] Token 验证成功，userId: xxx
[SSE] 开始建立连接，当前进度: pending 0%
[SSE] 已发送初始进度: ...
[SSE] 推送进度更新: collecting 10% - 获取项目列表...
```

### 4. 常见问题

#### 问题 1: CORS 错误

**症状：** 浏览器控制台显示 CORS 相关错误

**解决方案：** 
- 确保后端已配置 CORS
- 检查 `Access-Control-Allow-Origin` 响应头

#### 问题 2: 401 Unauthorized

**症状：** SSE 请求返回 401

**可能原因：**
- Token 无效或过期
- Token 未正确传递

**解决方案：**
- 检查 localStorage 中是否有 token
- 检查 URL 中的 token 参数是否正确

#### 问题 3: 404 Not Found

**症状：** SSE 请求返回 404

**可能原因：**
- 任务不存在或已过期
- URL 路径错误

**解决方案：**
- 检查 taskId 是否正确
- 确保任务已创建且未过期（1小时内）

#### 问题 4: 连接立即关闭

**症状：** 连接建立后立即关闭

**可能原因：**
- 任务已完成或失败
- 服务器端错误

**解决方案：**
- 检查后端日志
- 检查任务状态

### 5. 手动测试 SSE 连接

可以使用以下命令测试 SSE 端点：

```bash
# 使用 curl 测试（需要替换 token 和 taskId）
curl -N "http://localhost:3000/api/ai-summary/progress/{taskId}/stream?token={token}"
```

应该能看到类似以下的输出：
```
data: {"success":true,"data":{"taskId":"...","status":"pending",...}}

data: {"success":true,"data":{"taskId":"...","status":"collecting",...}}

: heartbeat
```

### 6. 降级到轮询

如果 SSE 连接失败，系统会自动降级到轮询模式。你会看到：

```
[SSE] 连接错误: ...
实时连接失败，切换到轮询模式
```

轮询模式会每 2 秒查询一次进度，功能仍然可用，只是不是实时的。

## 调试技巧

### 1. 启用详细日志

前端代码中已经添加了详细的日志，包括：
- `[SSE] 连接 URL` - 显示连接的 URL（token 已隐藏）
- `[SSE] 连接已建立` - 连接成功
- `[SSE] 收到消息` - 收到进度更新
- `[SSE] 进度更新` - 进度状态和百分比
- `[SSE] 连接错误` - 连接错误信息

### 2. 检查 EventSource readyState

```javascript
// 在浏览器控制台中运行
eventSource.readyState
// 0 = CONNECTING
// 1 = OPEN
// 2 = CLOSED
```

### 3. 监听所有事件

```javascript
// 在浏览器控制台中运行
eventSource.addEventListener('message', (e) => console.log('Message:', e.data));
eventSource.addEventListener('error', (e) => console.log('Error:', e));
eventSource.addEventListener('open', () => console.log('Open'));
```

## 预期行为

### 正常流程

1. 用户点击"立即发送测试"
2. 前端创建 SSE 连接
3. 后端立即发送当前进度
4. 后端推送进度更新（收集数据、生成总结、发送邮件）
5. 任务完成后关闭连接

### 进度更新频率

- **初始进度**：连接建立时立即发送
- **进度更新**：每次 `updateProgress` 调用时推送
- **心跳**：每 30 秒发送一次（保持连接）

## 如果仍然无法使用 SSE

如果 SSE 仍然无法工作，系统会自动降级到轮询模式，功能仍然可用。轮询模式：

- 每 2 秒查询一次进度
- 功能完全正常
- 只是不是实时推送

你可以通过浏览器控制台查看是否降级到了轮询模式。

