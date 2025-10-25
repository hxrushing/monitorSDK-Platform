# SDK批量发送机制

## 🚀 功能特性

### 核心功能
- **批量发送**: 将多个事件合并为一次网络请求，大幅减少网络开销
- **智能队列**: 基于优先级的事件队列管理
- **离线支持**: 网络断开时自动存储事件到本地，恢复后自动发送
- **重试机制**: 发送失败时自动重试，支持指数退避
- **性能优化**: 定时刷新、页面卸载时发送、移动端页面隐藏时发送

### 配置选项
```typescript
interface BatchConfig {
  maxBatchSize: number;        // 最大批量大小 (默认: 50)
  flushInterval: number;        // 刷新间隔毫秒 (默认: 5000)
  maxRetries: number;          // 最大重试次数 (默认: 3)
  retryDelay: number;          // 重试延迟毫秒 (默认: 1000)
  enableOfflineStorage: boolean; // 是否启用离线存储 (默认: true)
  maxStorageSize: number;      // 最大存储大小字节 (默认: 1MB)
}
```

## 📖 使用方法

### 1. 基本使用
```typescript
import AnalyticsSDK from './index';

// 使用默认配置
const sdk = AnalyticsSDK.getInstance('your-project-id', 'http://localhost:3000/api/track');

// 发送事件
sdk.track('page_view', { page: '/home' });
```

### 2. 自定义配置
```typescript
const customSdk = AnalyticsSDK.getInstance('project-id', 'endpoint', {
  maxBatchSize: 20,        // 最大批量20个事件
  flushInterval: 3000,      // 3秒刷新一次
  maxRetries: 5,           // 最大重试5次
  retryDelay: 2000,        // 重试延迟2秒
  enableOfflineStorage: true,
  maxStorageSize: 2 * 1024 * 1024, // 2MB存储
});
```

### 3. 优先级事件
```typescript
// 普通优先级（默认）
sdk.track('user_action', { action: 'click' });

// 高优先级（错误事件）
sdk.track('error', { message: 'Something went wrong' }, 'high');

// 低优先级（非关键事件）
sdk.track('background_event', { data: 'non-critical' }, 'low');
```

### 4. 手动控制
```typescript
// 立即发送所有待发送事件
await sdk.flush();

// 获取队列状态
const status = sdk.getQueueStatus();
console.log('队列长度:', status.queueLength);
console.log('是否在线:', status.isOnline);

// 动态更新配置
sdk.updateBatchConfig({
  flushInterval: 10000, // 改为10秒刷新
  maxBatchSize: 100     // 改为最大100个事件
});
```

## 🔧 后端支持

### API端点
批量事件发送到 `/api/track` 端点，支持以下数据格式：

```typescript
// 批量事件格式
{
  projectId: string;
  events: EventData[];
  batchSize: number;
  timestamp: number;
  uid?: string;
  deviceInfo: any;
  sdkVersion: string;
}

// 单个事件格式（向后兼容）
{
  projectId: string;
  eventName: string;
  eventParams: any;
  uid?: string;
  deviceInfo: any;
  timestamp: number;
}
```

### 响应格式
```typescript
{
  success: boolean;
  processedCount: number;
  failedEvents?: any[]; // 失败的事件列表
}
```

## 📊 性能优势

### 网络请求减少
- **传统方式**: 每个事件1次请求
- **批量方式**: 50个事件1次请求
- **性能提升**: 网络请求减少98%

### 带宽节省
- **压缩传输**: 批量数据可进行gzip压缩
- **头部开销**: 减少HTTP头部重复开销
- **连接复用**: 减少TCP连接建立开销

### 用户体验
- **离线支持**: 网络断开时事件不丢失
- **后台发送**: 不影响用户操作流畅性
- **智能重试**: 网络恢复后自动重发

## 🧪 测试

### 运行测试
```typescript
import { batchTester } from './test';

// 运行所有测试
await batchTester.runAllTests();

// 清理测试数据
batchTester.cleanup();
```

### 测试覆盖
- ✅ 基本批量发送
- ✅ 优先级处理
- ✅ 离线存储
- ✅ 重试机制
- ✅ 性能测试

## 🚨 注意事项

### 1. 数据一致性
- 批量发送使用数据库事务确保数据一致性
- 部分失败时会返回失败事件列表
- 建议监控失败事件并处理

### 2. 存储限制
- 离线存储有大小限制，超出会删除旧事件
- 建议根据业务需求调整 `maxStorageSize`
- 定期清理不需要的离线数据

### 3. 网络环境
- 在弱网环境下建议增加 `flushInterval`
- 移动端建议启用页面隐藏时发送
- 考虑使用Service Worker进行后台发送

### 4. 错误处理
- 监控SDK错误日志
- 设置合理的重试次数和延迟
- 考虑实现降级策略

## 🔄 迁移指南

### 从旧版本迁移
1. 更新SDK初始化代码
2. 后端添加批量处理支持
3. 测试批量发送功能
4. 监控性能指标

### 向后兼容
- 旧的单个事件发送方式仍然支持
- 可以逐步迁移到批量发送
- 不影响现有功能

## 📈 监控指标

### 关键指标
- 队列长度
- 批量发送成功率
- 平均批量大小
- 离线事件数量
- 重试次数

### 建议监控
```typescript
// 定期检查队列状态
setInterval(() => {
  const status = sdk.getQueueStatus();
  console.log('SDK状态:', status);
}, 30000);
```

## 🎯 最佳实践

1. **合理设置批量大小**: 根据网络环境和业务需求调整
2. **监控队列状态**: 定期检查队列长度和发送状态
3. **处理失败事件**: 实现失败事件的重新发送机制
4. **优化存储策略**: 根据设备存储能力调整离线存储大小
5. **测试网络环境**: 在不同网络环境下测试SDK表现
