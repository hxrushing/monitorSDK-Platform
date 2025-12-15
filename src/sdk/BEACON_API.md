# Beacon API 使用说明

## 📋 概述

Beacon API 是专门为在页面关闭时发送数据而设计的浏览器 API。它确保数据能够成功发送，不会因为页面卸载而被取消。

## ✨ 特性

1. **异步发送**: 不阻塞页面卸载，保证用户体验
2. **可靠传输**: 浏览器保证数据发送完成，即使页面已关闭
3. **自动回退**: 不支持 Beacon API 的浏览器会自动回退到普通发送方式
4. **数据保护**: 发送失败时自动保存到离线存储

## 🚀 自动使用

SDK 会在以下场景自动使用 Beacon API：

1. **页面关闭时** (`beforeunload` 事件)
2. **页面隐藏时** (`pagehide` 事件，排除 bfcache 情况)
3. **移动端页面隐藏时** (`visibilitychange` 事件)

```typescript
// SDK 自动处理，无需手动调用
// 页面关闭时，队列中的所有事件会自动通过 Beacon API 发送
```

## 📖 手动使用

### 1. 发送单个事件

```typescript
import AnalyticsSDK from '@/sdk';

const sdk = AnalyticsSDK.getInstance('project-id', 'http://localhost:3000/api/track');

// 使用 Beacon API 发送关键事件（如页面浏览）
const sent = sdk.sendWithBeacon('pageview', {
  路径: window.location.pathname,
  页面标题: document.title,
  时间戳: Date.now()
});

if (sent) {
  console.log('事件已通过 Beacon API 发送');
} else {
  console.log('Beacon API 发送失败，事件已加入队列');
}
```

### 2. 检查浏览器支持

```typescript
if (sdk.isBeaconSupported()) {
  console.log('浏览器支持 Beacon API');
  // 可以使用 sendWithBeacon 方法
} else {
  console.log('浏览器不支持 Beacon API，将使用普通方式');
  // 使用 track 方法
}
```

## 🔧 实现细节

### 数据格式

Beacon API 发送的数据格式与普通批量发送相同：

```typescript
{
  projectId: string;
  events: EventData[];
  batchSize: number;
  timestamp: number;
  uid?: string;
  deviceInfo: any;
  sdkVersion: string;
}
```

### 数据大小限制

- Beacon API 有数据大小限制（通常 64KB）
- 如果数据过大，会自动保存到离线存储
- 建议控制单个事件的大小

### 浏览器支持

| 浏览器 | 版本要求 |
|--------|---------|
| Chrome | 39+ |
| Firefox | 31+ |
| Safari | 11.1+ |
| Edge | 14+ |
| Opera | 26+ |

## ⚠️ 注意事项

1. **Content-Type**: Beacon API 发送的数据会自动设置 `Content-Type: application/json`
2. **CORS**: 需要确保服务器支持 CORS，允许 Beacon API 的请求
3. **数据大小**: 注意数据大小限制，避免超过 64KB
4. **离线存储**: 发送失败时，数据会自动保存到离线存储，下次上线时自动发送

## 🔍 调试

### 查看 Beacon API 发送状态

```typescript
// 在控制台查看日志
// 成功: [SDK] 使用 Beacon API 成功发送 X 个事件
// 失败: [SDK] Beacon API 发送失败，事件已保存到离线存储
```

### 网络面板检查

1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 过滤 `track` 请求
4. 查看请求类型为 `beacon` 的请求

## 📊 性能影响

- **页面卸载**: Beacon API 不会阻塞页面卸载，用户体验良好
- **网络请求**: 异步发送，不影响页面性能
- **数据丢失**: 相比普通 fetch，Beacon API 能更好地保证数据不丢失

## 🎯 最佳实践

1. **关键事件**: 对于关键事件（如页面浏览、转化事件），使用 `sendWithBeacon()`
2. **批量事件**: 普通事件使用 `track()`，SDK 会自动在页面关闭时批量发送
3. **数据大小**: 控制事件数据大小，避免超过限制
4. **错误处理**: 监听 SDK 日志，了解 Beacon API 发送状态

## 🔄 与普通发送的区别

| 特性 | Beacon API | 普通 fetch |
|------|-----------|-----------|
| 页面关闭时 | ✅ 保证发送 | ❌ 可能被取消 |
| 阻塞页面 | ❌ 不阻塞 | ⚠️ 可能阻塞 |
| 数据大小限制 | ⚠️ 64KB | ✅ 无限制 |
| 错误处理 | ⚠️ 有限 | ✅ 完整 |
| 浏览器支持 | ⚠️ 现代浏览器 | ✅ 所有浏览器 |

## 📚 参考文档

- [MDN: Navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [W3C: Beacon API Specification](https://w3c.github.io/beacon/)

