# ML服务启动说明

## 问题：ECONNREFUSED 错误

如果看到 `ECONNREFUSED ::1:5000` 或类似的连接错误，说明 Node.js 后端无法连接到 ML 服务。

## 解决方案

### 1. 确保 ML 服务已启动

在 `ml-service` 目录下启动服务：

```bash
cd ml-service
python app.py
```

服务启动后，您应该看到类似以下信息：

```
==================================================
时序预测服务启动中...
服务地址: http://localhost:5000
TensorFlow可用: True
支持模型: LSTM, GRU
==================================================
```

### 2. 检查服务是否正常运行

在浏览器中访问：`http://localhost:5000/health`

或者运行测试脚本：

```bash
cd ml-service
python test_service.py
```

### 3. 配置后端服务地址（如果需要）

如果 ML 服务运行在不同的地址或端口，需要在 `server/.env` 文件中配置：

```env
ML_SERVICE_URL=http://127.0.0.1:5000
```

**注意**：建议使用 `127.0.0.1` 而不是 `localhost`，以避免 IPv6/IPv4 解析问题。

### 4. 常见问题排查

#### 问题1：端口被占用

如果看到 "Address already in use" 错误：

1. 查找占用端口的进程：
   ```bash
   # Windows PowerShell
   netstat -ano | findstr :5000
   ```

2. 关闭占用端口的进程，或修改 ML 服务端口：
   ```env
   # ml-service/.env
   ML_SERVICE_PORT=5001
   ```

3. 同时更新后端配置：
   ```env
   # server/.env
   ML_SERVICE_URL=http://127.0.0.1:5001
   ```

#### 问题2：IPv6/IPv4 解析问题

如果使用 `localhost` 可能解析为 IPv6 (`::1`)，而服务只监听 IPv4。

**解决方案**：
- 使用 `127.0.0.1` 代替 `localhost`
- 代码已自动处理此问题，默认使用 `127.0.0.1`

#### 问题3：防火墙阻止连接

确保防火墙允许 5000 端口的连接。

### 5. 验证连接

重启后端服务后，在前端"时序预测"页面点击"刷新状态"按钮，应该显示"可用"。

## 启动顺序

正确的启动顺序：

1. **启动数据库**（如果使用本地数据库）
2. **启动 ML 服务**：
   ```bash
   cd ml-service
   python app.py
   ```
3. **启动后端服务**：
   ```bash
   cd server
   npm run dev
   ```
4. **启动前端服务**：
   ```bash
   npm run dev
   ```

## 测试连接

可以使用以下命令测试 ML 服务是否可访问：

```bash
# Windows PowerShell
Invoke-WebRequest -Uri http://127.0.0.1:5000/health -UseBasicParsing

# 或使用 curl（如果已安装）
curl http://127.0.0.1:5000/health
```

如果返回 JSON 响应，说明服务正常运行。

