# Fetch 上报与事件优先级队列设计说明

## 📋 概述

本文档详细说明 SDK 中埋点数据的上报机制和优先级队列的设计实现，包括为什么选择 Fetch API 作为主要上报方式，以及如何通过优先级队列确保关键数据的及时上报。

---

## 一、优先级队列设计

### 1.1 队列数据结构

每个事件在队列中存储为 `QueuedEvent` 对象：

```typescript
interface QueuedEvent {
  id: string;              // 唯一标识（UUID）
  data: any;              // 事件数据
  timestamp: number;       // 时间戳
  retryCount: number;      // 重试次数
  priority: 'high' | 'normal' | 'low';  // 优先级
}
```

### 1.2 优先级插入策略

队列使用数组实现，通过不同的插入方式实现优先级：

```typescript
// 根据优先级插入队列
if (priority === 'high') {
  this.eventQueue.unshift(queuedEvent);  // 高优先级：插入队列头部
} else {
  this.eventQueue.push(queuedEvent);     // 普通/低优先级：插入队列尾部
}
```

**设计要点：**
- ✅ **高优先级事件**：使用 `unshift()` 插入队列头部，确保优先发送
- ✅ **普通/低优先级事件**：使用 `push()` 插入队列尾部，按顺序发送
- ✅ **发送时**：使用 `splice(0, batchSize)` 从头部取出，保证高优先级先发送

### 1.3 优先级应用场景

#### 高优先级（`high`）
- 错误事件（JavaScript Error、Promise Rejection）
- 白屏检测事件
- 关键异常和性能问题
- 页面崩溃相关事件

```typescript
// 错误事件自动使用高优先级
public trackError(errorType: string, errorDetails: Record<string, any>) {
  this.track('error', {
    错误类型: errorType,
    ...errorDetails,
    发生时间: new Date().toISOString()
  }, 'high'); // 错误事件使用高优先级
}
```

#### 普通优先级（`normal`）
- 用户行为事件（点击、滚动等）
- 页面浏览事件
- 业务相关事件

```typescript
// 用户行为使用普通优先级
public trackUserAction(action: string, actionDetails: Record<string, any>) {
  this.track('userAction', {
    用户行为: action,
    ...actionDetails,
    行为时间: new Date().toISOString()
  }, 'normal'); // 用户行为使用普通优先级
}
```

#### 低优先级（`low`）
- 后台统计事件
- 非关键的性能指标
- 可延迟上报的数据

### 1.4 队列触发机制

队列会在以下情况触发发送：

1. **达到批量大小限制**：队列长度达到配置的批量大小时立即发送
2. **定时刷新**：每 5 秒（可配置）自动刷新队列
3. **页面卸载时**：使用 Beacon API 发送剩余事件
4. **网络恢复时**：自动发送离线存储的事件
5. **手动触发**：调用 `flush()` 方法立即发送

---

## 二、Fetch 上报实现

### 2.1 核心发送逻辑

```typescript
private async sendBatch(events: QueuedEvent[]): Promise<BatchResponse> {
  const batchData = {
    projectId: this.projectId,
    events: events.map(event => event.data),
    batchSize: events.length,
    timestamp: Date.now(),
    ...this.commonParams
  };

  try {
    // 使用 AbortController 支持超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 根据状态码创建更具体的错误
      const statusCode = response.status;
      if (statusCode >= 500) {
        throw new Error(`Server error: ${statusCode}`);
      } else if (statusCode >= 400) {
        throw new Error(`Client error: ${statusCode}`);
      }
    }

    return {
      success: true,
      processedCount: events.length,
      failedEvents: []
    };
  } catch (fetchError: any) {
    // 处理不同类型的错误
    if (fetchError.name === 'AbortError') {
      throw new Error('Request timeout');
    } else if (fetchError.message?.includes('Failed to fetch')) {
      throw new Error(`Network error: ${fetchError.message}`);
    }
    throw fetchError;
  }
}
```

### 2.2 关键特性

#### ✅ 超时控制
- 使用 `AbortController` 实现 10 秒超时
- 超时后自动取消请求，避免长时间等待

#### ✅ 错误分类
- **超时错误**：`AbortError`
- **网络错误**：`Failed to fetch`、连接错误
- **服务器错误**：HTTP 5xx
- **客户端错误**：HTTP 4xx

#### ✅ 批量发送
- 将多个事件合并为一次请求
- 减少网络开销和服务器压力
- 支持自适应批量大小调整

---

## 三、为什么选择 Fetch API？

### 3.1 技术对比

| 特性 | Fetch API | XMLHttpRequest | Beacon API |
|------|-----------|----------------|------------|
| **Promise 支持** | ✅ 原生支持 | ❌ 需封装 | ❌ 返回 boolean |
| **超时控制** | ✅ AbortController | ✅ 原生支持 | ❌ 不支持 |
| **错误处理** | ✅ 完善的错误分类 | ⚠️ 需要手动处理 | ❌ 无法获取响应 |
| **代码简洁性** | ✅ 简洁现代 | ❌ 回调复杂 | ✅ 简洁但功能受限 |
| **响应处理** | ✅ 完整的 Response 对象 | ⚠️ 需要解析 | ❌ 无响应 |
| **请求取消** | ✅ AbortController | ⚠️ abort() | ❌ 不支持 |
| **适用场景** | 正常批量发送 | 兼容性要求高 | 页面卸载时 |

### 3.2 选择 Fetch 的核心原因

#### 1. **现代 API，Promise 原生支持**

```typescript
// Fetch - 简洁现代
const response = await fetch(url, options);
const data = await response.json();

// XHR - 回调复杂
const xhr = new XMLHttpRequest();
xhr.onload = () => { 
  const data = JSON.parse(xhr.responseText);
};
xhr.onerror = () => { /* 错误处理 */ };
xhr.open('POST', url);
xhr.send(data);
```

#### 2. **超时控制更优雅**

```typescript
// Fetch 使用 AbortController
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);
fetch(url, { signal: controller.signal });

// XHR 需要手动管理
const xhr = new XMLHttpRequest();
const timeout = setTimeout(() => xhr.abort(), 10000);
xhr.onloadend = () => clearTimeout(timeout);
```

#### 3. **完善的错误处理**

Fetch 可以区分不同类型的错误，便于实现差异化的重试策略：

```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    // 可以根据状态码分类处理
    if (response.status >= 500) {
      // 服务器错误，可以重试
    } else if (response.status >= 400) {
      // 客户端错误，可能不需要重试
    }
  }
} catch (error) {
  if (error.name === 'AbortError') {
    // 超时错误
  } else if (error.message.includes('Failed to fetch')) {
    // 网络错误
  }
}
```

#### 4. **与 Beacon API 的配合使用**

SDK 采用 **混合策略**：
- **正常批量发送**：使用 Fetch API（支持响应处理、错误分类、重试）
- **页面卸载时**：使用 Beacon API（保证数据不丢失，不阻塞页面卸载）

```typescript
// 正常批量发送 - 使用 Fetch
private async sendBatch() {
  const response = await fetch(this.endpoint, { ... });
  // 可以处理响应和错误
}

// 页面卸载时 - 使用 Beacon
private flushQueueWithBeacon() {
  navigator.sendBeacon(this.endpoint, blob);
  // 不阻塞页面卸载，但无法获取响应
}
```

### 3.3 Fetch vs Beacon 使用场景

| 场景 | 使用方式 | 原因 |
|------|---------|------|
| 正常批量发送 | Fetch API | 需要错误处理、重试机制、响应验证 |
| 页面卸载时 | Beacon API | 不阻塞卸载，浏览器保证发送 |
| 页面隐藏时 | Beacon API（优先）或 Fetch | 移动端页面切换场景 |
| 关键事件立即发送 | Fetch API | 需要确认发送成功 |

---

## 四、错误处理与重试机制

### 4.1 错误分类

SDK 会根据错误类型进行分类，用于差异化处理：

```typescript
private classifyError(error?: Error): ErrorType {
  // network: 网络连接错误、CORS错误、fetch失败
  // timeout: 请求超时、AbortError
  // server: HTTP 5xx 错误（服务器内部错误）
  // client: HTTP 4xx 错误（客户端错误）
  // unknown: 其他未知错误
}
```

### 4.2 指数退避重试

失败的事件会根据错误类型和重试次数计算退避延迟：

```typescript
// 指数退避公式
延迟 = baseDelay × multiplier^(retryCount-1)

// 示例（baseDelay=1000ms, multiplier=2）
// 第1次重试: 1000ms
// 第2次重试: 2000ms
// 第3次重试: 4000ms
// 第4次重试: 8000ms
```

**优化特性：**
- ✅ **抖动机制**：添加随机抖动避免雷群效应
- ✅ **网络感知**：根据网络质量调整延迟
- ✅ **错误类型感知**：不同错误类型使用不同策略
- ✅ **最大延迟限制**：防止退避时间过长（默认 30 秒）

### 4.3 离线存储

超过最大重试次数的事件会保存到本地存储：

```typescript
if (event.retryCount >= this.batchConfig.maxRetries) {
  // 保存到离线存储
  this.saveEventToOfflineStorage(event);
}
```

网络恢复后自动发送离线事件。

---

## 五、设计亮点总结

### 5.1 优先级队列

- ✅ **高优先级事件优先发送**：确保关键数据（错误、异常）及时上报
- ✅ **简单高效的实现**：使用数组的 `unshift/push` 方法，O(1) 时间复杂度
- ✅ **灵活的优先级配置**：支持三种优先级，可根据业务需求调整

### 5.2 Fetch + Beacon 混合策略

- ✅ **正常场景用 Fetch**：支持完整的错误处理和重试机制
- ✅ **卸载场景用 Beacon**：保证数据不丢失，不阻塞页面卸载
- ✅ **最佳实践**：结合两种 API 的优势，兼顾功能性和可靠性

### 5.3 完善的错误处理

- ✅ **错误分类**：区分超时、网络、服务器、客户端错误
- ✅ **差异化重试**：不同错误类型使用不同的重试策略
- ✅ **指数退避**：避免重试风暴，提高成功率

### 5.4 离线容错

- ✅ **自动存储**：网络失败时自动保存到本地
- ✅ **自动恢复**：网络恢复后自动发送离线事件
- ✅ **存储限制**：防止本地存储溢出

### 5.5 性能优化

- ✅ **批量发送**：减少网络请求次数（50 个事件合并为 1 次请求）
- ✅ **自适应批量**：根据网络状况动态调整批量大小
- ✅ **数据压缩**：支持数据压缩，减少传输量

---

## 六、使用示例

### 6.1 基本使用

```typescript
import AnalyticsSDK from '@/sdk';

const sdk = AnalyticsSDK.getInstance('project-id', 'http://localhost:3000/api/track');

// 发送普通优先级事件
sdk.track('page_view', { page: '/home' });

// 发送高优先级事件（错误）
sdk.trackError('JavaScript Error', {
  message: 'Cannot read property of undefined',
  stack: 'Error stack trace...'
});

// 手动刷新队列
await sdk.flush();
```

### 6.2 自定义优先级

```typescript
// 高优先级
sdk.track('critical_event', { data: 'important' }, 'high');

// 普通优先级（默认）
sdk.track('normal_event', { data: 'normal' }, 'normal');

// 低优先级
sdk.track('background_event', { data: 'non-critical' }, 'low');
```

### 6.3 监控队列状态

```typescript
// 获取队列状态
const status = sdk.getQueueStatus();
console.log('队列长度:', status.queueLength);
console.log('是否在线:', status.isOnline);

// 获取网络状况
const networkMetrics = sdk.getNetworkMetrics();
if (networkMetrics) {
  console.log('网络RTT:', networkMetrics.rtt, 'ms');
  console.log('网络质量:', networkMetrics.quality);
}
```

---

## 七、最佳实践

### 7.1 优先级使用建议

1. **错误事件**：始终使用高优先级
2. **用户行为**：使用普通优先级
3. **后台统计**：使用低优先级
4. **关键业务事件**：根据重要性选择优先级

### 7.2 批量配置建议

```typescript
// 网络环境好
{
  maxBatchSize: 100,
  flushInterval: 5000
}

// 网络环境差
{
  maxBatchSize: 20,
  flushInterval: 10000
}

// 启用自适应批量
{
  adaptive: {
    enabled: true,
    minBatchSize: 10,
    maxBatchSize: 100
  }
}
```

### 7.3 错误处理建议

1. **监控队列状态**：定期检查队列长度，防止队列堆积
2. **监控重试记录**：关注重试次数和失败原因
3. **设置合理的重试次数**：避免无限重试
4. **处理离线事件**：确保离线存储的事件能够成功发送

---

## 八、技术细节

### 8.1 队列实现

- **数据结构**：使用数组 `QueuedEvent[]`
- **插入操作**：高优先级 `O(1)`，普通优先级 `O(1)`
- **取出操作**：`O(n)`（n 为批量大小），但实际性能影响很小

### 8.2 Fetch 超时处理

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    // 超时处理
  }
}
```

### 8.3 错误分类逻辑

```typescript
// 网络错误
if (errorMessage.includes('network') || 
    errorMessage.includes('fetch') || 
    errorMessage.includes('connection')) {
  return 'network';
}

// 超时错误
if (errorMessage.includes('timeout') || 
    errorMessage.includes('aborted')) {
  return 'timeout';
}

// 服务器错误
if (statusCode >= 500) {
  return 'server';
}

// 客户端错误
if (statusCode >= 400) {
  return 'client';
}
```

---

## 九、总结

SDK 的 Fetch 上报与优先级队列设计具有以下优势：

1. **可靠性**：完善的错误处理和重试机制，确保数据不丢失
2. **性能**：批量发送和自适应调整，减少网络开销
3. **灵活性**：支持优先级配置，满足不同业务需求
4. **现代性**：使用 Fetch API，代码简洁易维护
5. **兼容性**：Fetch + Beacon 混合策略，兼顾功能性和可靠性

该设计在功能完整性、性能优化和用户体验之间取得了良好的平衡，是一个生产级的实现方案。

