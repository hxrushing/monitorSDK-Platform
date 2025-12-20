# 手动 Flush 与调试能力设计说明

## 📋 概述

本文档详细说明 SDK 中手动 flush 功能的使用场景、调试能力的实现，以及动态调度机制中的异常处理策略，帮助开发者更好地调试和排查埋点链路问题。

---

## 一、手动 Flush 功能

### 1.1 功能定义

手动 flush 允许开发者主动触发队列发送，无需等待定时刷新或达到批量大小限制。

```typescript
// 手动刷新队列（公开方法）
public flush(): Promise<void> {
  return this.flushQueue(true);
}
```

**核心特性：**
- ✅ **立即发送**：忽略定时器和批量大小限制
- ✅ **Promise 支持**：可以等待发送完成
- ✅ **异常处理**：完整的错误处理和重试机制
- ✅ **状态反馈**：通过日志和返回值提供状态信息

### 1.2 使用场景

#### 场景一：开发调试

```typescript
// 在开发环境中，立即发送事件以便调试
if (process.env.NODE_ENV === 'development') {
  sdk.track('test_event', { data: 'test' });
  await sdk.flush();  // 立即发送，查看效果
  console.log('事件已发送，可在 Network 面板查看');
}
```

#### 场景二：关键操作后立即上报

```typescript
// 用户完成关键操作后，立即上报
async function handlePurchase() {
  try {
    await processPayment();
    
    // 关键事件立即上报
    sdk.track('purchase_completed', {
      orderId: order.id,
      amount: order.amount
    });
    
    // 立即发送，确保数据不丢失
    await sdk.flush();
    
    console.log('购买事件已上报');
  } catch (error) {
    sdk.trackError('purchase_failed', { error: error.message });
    await sdk.flush();
  }
}
```

#### 场景三：页面跳转前上报

```typescript
// 在页面跳转前，确保事件已发送
function navigateToNextPage() {
  // 发送页面离开事件
  sdk.track('page_leave', {
    currentPage: window.location.pathname,
    nextPage: '/next-page'
  });
  
  // 立即发送
  sdk.flush().then(() => {
    // 确保事件发送后再跳转
    window.location.href = '/next-page';
  }).catch(() => {
    // 即使发送失败也跳转，避免阻塞用户
    window.location.href = '/next-page';
  });
}
```

#### 场景四：测试和验证

```typescript
// 在测试中验证事件发送
describe('SDK Event Tracking', () => {
  it('should send events correctly', async () => {
    sdk.track('test_event', { test: true });
    
    // 立即发送并等待完成
    await sdk.flush();
    
    // 验证事件已发送（通过 mock 或检查网络请求）
    expect(mockFetch).toHaveBeenCalled();
  });
});
```

### 1.3 实现细节

#### 核心实现

```typescript
// 刷新队列（发送批量事件）
private async flushQueue(_force: boolean = false): Promise<void> {
  if (this.eventQueue.length === 0) return;

  // 如果离线且启用离线存储，保存到本地
  if (!this.isOnline && this.batchConfig.enableOfflineStorage) {
    this.saveToOfflineStorage();
    return;
  }

  // 确定批量大小（使用自适应或固定值）
  const batchSize = this.batchConfig.adaptive?.enabled 
    ? this.currentBatchSize 
    : this.batchConfig.maxBatchSize;

  // 准备批量发送的数据
  const eventsToSend = this.eventQueue.splice(0, batchSize);
  const sendStartTime = performance.now();
  
  try {
    const response = await this.sendBatch(eventsToSend);
    const sendDuration = performance.now() - sendStartTime;
    
    if (response.success) {
      console.log(`批量发送成功，处理了 ${response.processedCount} 个事件，耗时 ${sendDuration.toFixed(2)}ms`);
      
      // 记录发送结果（用于自适应调整）
      this.recordSendResult(true, sendDuration, eventsToSend.length);
      
      // 处理失败的事件
      if (response.failedEvents && response.failedEvents.length > 0) {
        this.handleFailedEvents(response.failedEvents);
      }
    } else {
      // 发送失败，重新加入队列
      this.eventQueue.unshift(...eventsToSend);
      this.handleFailedEvents(eventsToSend, new Error('发送失败'));
      this.recordSendResult(false, sendDuration, eventsToSend.length);
    }
  } catch (error) {
    const sendDuration = performance.now() - sendStartTime;
    console.error('批量发送失败:', error);
    // 发送失败，重新加入队列
    this.eventQueue.unshift(...eventsToSend);
    this.handleFailedEvents(eventsToSend, error as Error);
    this.recordSendResult(false, sendDuration, eventsToSend.length);
  }
}
```

**关键点：**
- ✅ **强制发送**：`_force` 参数表示手动触发，忽略定时器
- ✅ **完整错误处理**：捕获异常并重新加入队列
- ✅ **性能监控**：记录发送耗时，用于自适应调整
- ✅ **重试机制**：失败事件自动进入重试流程

---

## 二、调试能力

### 2.1 队列状态监控

#### 获取队列状态

```typescript
public getQueueStatus(): { 
  queueLength: number; 
  isOnline: boolean; 
  config: BatchConfig 
} {
  return {
    queueLength: this.eventQueue.length,
    isOnline: this.isOnline,
    config: this.batchConfig
  };
}
```

**使用示例：**

```typescript
// 定期检查队列状态
setInterval(() => {
  const status = sdk.getQueueStatus();
  console.log('队列状态:', {
    队列长度: status.queueLength,
    是否在线: status.isOnline,
    配置: status.config
  });
  
  // 如果队列积压，手动 flush
  if (status.queueLength > 100) {
    console.warn('队列积压，手动 flush');
    sdk.flush();
  }
}, 5000);
```

#### 调试工具函数

```typescript
// 创建一个调试工具函数
function debugSDK(sdk: AnalyticsSDK) {
  const status = sdk.getQueueStatus();
  const networkMetrics = sdk.getNetworkMetrics();
  const adaptiveStatus = sdk.getAdaptiveBatchStatus();
  const retryStats = sdk.getRetryStatistics();
  const compressionStats = sdk.getCompressionStats();
  
  console.group('📊 SDK 调试信息');
  console.log('队列状态:', {
    队列长度: status.queueLength,
    是否在线: status.isOnline
  });
  
  if (networkMetrics) {
    console.log('网络状况:', {
      RTT: `${networkMetrics.rtt.toFixed(2)}ms`,
      带宽: `${(networkMetrics.bandwidth / 1024 / 1024).toFixed(2)}Mbps`,
      质量: networkMetrics.quality,
      连接类型: networkMetrics.connectionType
    });
  }
  
  if (adaptiveStatus.enabled) {
    console.log('自适应批量:', {
      当前批量大小: adaptiveStatus.currentBatchSize,
      发送成功率: `${(adaptiveStatus.recentSuccessRate * 100).toFixed(1)}%`
    });
  }
  
  if (retryStats.totalRetries > 0) {
    console.log('重试统计:', {
      总重试数: retryStats.totalRetries,
      活跃重试: retryStats.activeRetries,
      平均延迟: `${retryStats.avgBackoffDelay.toFixed(0)}ms`
    });
  }
  
  if (compressionStats) {
    console.log('压缩统计:', {
      压缩比: `${(compressionStats.compressionRatio * 100).toFixed(1)}%`,
      原始大小: `${(compressionStats.originalSize / 1024).toFixed(2)}KB`,
      压缩后大小: `${(compressionStats.compressedSize / 1024).toFixed(2)}KB`
    });
  }
  
  console.groupEnd();
}

// 在控制台使用
// debugSDK(sdk);
```

### 2.2 网络状况监控

#### 获取网络指标

```typescript
public getNetworkMetrics(): NetworkMetrics | null {
  return this.networkMetrics ? { ...this.networkMetrics } : null;
}
```

**使用示例：**

```typescript
// 监控网络状况变化
let lastNetworkQuality: string | null = null;

setInterval(async () => {
  const metrics = sdk.getNetworkMetrics();
  
  if (metrics) {
    // 网络质量变化时提醒
    if (lastNetworkQuality && lastNetworkQuality !== metrics.quality) {
      console.warn(`网络质量变化: ${lastNetworkQuality} → ${metrics.quality}`);
      
      // 网络变差时，手动 flush 确保数据发送
      if (metrics.quality === 'poor') {
        console.log('网络变差，手动 flush');
        await sdk.flush();
      }
    }
    
    lastNetworkQuality = metrics.quality;
  }
}, 10000);
```

#### 手动触发网络检测

```typescript
public checkNetworkManually(): Promise<void> {
  return this.checkNetworkStatus();
}
```

**使用示例：**

```typescript
// 在用户操作前检查网络
async function beforeCriticalAction() {
  // 手动检测网络
  await sdk.checkNetworkManually();
  
  const metrics = sdk.getNetworkMetrics();
  if (metrics && metrics.quality === 'poor') {
    // 网络差时，先发送已有事件
    await sdk.flush();
    console.warn('网络状况不佳，已发送已有事件');
  }
}
```

### 2.3 重试记录监控

#### 获取重试记录

```typescript
public getRetryRecords(): RetryRecord[] {
  return Array.from(this.retryRecords.values());
}

public getRetryRecord(eventId: string): RetryRecord | undefined {
  return this.retryRecords.get(eventId);
}

public getRetryStatistics(): {
  totalRetries: number;
  activeRetries: number;
  retriesByErrorType: Record<ErrorType, number>;
  avgBackoffDelay: number;
  maxBackoffDelay: number;
} {
  // ... 统计逻辑
}
```

**使用示例：**

```typescript
// 监控重试情况
function monitorRetries(sdk: AnalyticsSDK) {
  const stats = sdk.getRetryStatistics();
  
  if (stats.totalRetries > 0) {
    console.group('⚠️ 重试监控');
    console.log('总重试数:', stats.totalRetries);
    console.log('活跃重试:', stats.activeRetries);
    console.log('按错误类型:', stats.retriesByErrorType);
    console.log('平均延迟:', `${stats.avgBackoffDelay.toFixed(0)}ms`);
    
    // 如果重试过多，可能是网络或服务器问题
    if (stats.totalRetries > 10) {
      console.warn('重试次数过多，建议检查网络或服务器状态');
    }
    
    console.groupEnd();
  }
}

// 获取特定事件的重试记录
function checkEventRetry(sdk: AnalyticsSDK, eventId: string) {
  const record = sdk.getRetryRecord(eventId);
  if (record) {
    console.log('事件重试记录:', {
      事件ID: record.eventId,
      重试次数: record.retryCount,
      下次重试时间: new Date(record.nextRetryTime).toLocaleString(),
      错误类型: record.errorType
    });
  }
}
```

### 2.4 自适应批量状态监控

#### 获取自适应状态

```typescript
public getAdaptiveBatchStatus(): {
  enabled: boolean;
  currentBatchSize: number;
  networkMetrics: NetworkMetrics | null;
  queueLength: number;
  recentSuccessRate: number;
} {
  return {
    enabled: this.batchConfig.adaptive?.enabled || false,
    currentBatchSize: this.currentBatchSize,
    networkMetrics: this.getNetworkMetrics(),
    queueLength: this.eventQueue.length,
    recentSuccessRate: this.networkHistory.successRate
  };
}
```

**使用示例：**

```typescript
// 监控自适应批量调整
function monitorAdaptiveBatch(sdk: AnalyticsSDK) {
  const status = sdk.getAdaptiveBatchStatus();
  
  if (status.enabled) {
    console.log('自适应批量状态:', {
      当前批量大小: status.currentBatchSize,
      队列长度: status.queueLength,
      发送成功率: `${(status.recentSuccessRate * 100).toFixed(1)}%`,
      网络质量: status.networkMetrics?.quality || 'unknown'
    });
    
    // 如果批量大小异常，手动调整
    if (status.currentBatchSize < 5) {
      console.warn('批量大小过小，可能影响性能');
    } else if (status.currentBatchSize > 100) {
      console.warn('批量大小过大，可能影响延迟');
    }
  }
}
```

### 2.5 压缩统计监控

#### 获取压缩统计

```typescript
public getCompressionStats(): CompressionStats | null {
  return this.compressionStats ? { ...this.compressionStats } : null;
}
```

**使用示例：**

```typescript
// 监控压缩效果
function monitorCompression(sdk: AnalyticsSDK) {
  const stats = sdk.getCompressionStats();
  
  if (stats) {
    console.log('压缩统计:', {
      压缩比: `${(stats.compressionRatio * 100).toFixed(1)}%`,
      原始大小: `${(stats.originalSize / 1024).toFixed(2)}KB`,
      压缩后大小: `${(stats.compressedSize / 1024).toFixed(2)}KB`,
      算法: stats.algorithm,
      压缩耗时: `${stats.compressionTime.toFixed(2)}ms`
    });
    
    // 如果压缩比不理想，可能需要调整配置
    if (stats.compressionRatio > 0.9) {
      console.warn('压缩效果不佳，建议检查数据或调整压缩配置');
    }
  }
}
```

---

## 三、动态调度机制中的异常处理

### 3.1 异常分类

SDK 将异常分为以下类型：

```typescript
export type ErrorType = 'network' | 'timeout' | 'server' | 'client' | 'unknown';
```

#### 错误分类逻辑

```typescript
private classifyError(error?: Error): ErrorType {
  if (!error) {
    return 'unknown';
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';

  // 网络错误
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') || 
      errorMessage.includes('connection') ||
      errorName === 'networkerror' ||
      errorName === 'typeerror') {
    return 'network';
  }

  // 超时错误
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('aborted') ||
      errorName === 'timeouterror' ||
      errorName === 'aborterror') {
    return 'timeout';
  }

  // 服务器错误（5xx）
  if (errorMessage.includes('500') || 
      errorMessage.includes('502') || 
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('server error')) {
    return 'server';
  }

  // 客户端错误（4xx）
  if (errorMessage.includes('400') || 
      errorMessage.includes('401') || 
      errorMessage.includes('403') ||
      errorMessage.includes('404') ||
      errorMessage.includes('client error')) {
    return 'client';
  }

  return 'unknown';
}
```

### 3.2 异常处理流程

```
┌─────────────────┐
│  发送请求       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     成功     ┌─────────────────┐
│  等待响应       │───────────→│  记录成功        │
└────────┬────────┘            └─────────────────┘
         │ 失败
         ▼
┌─────────────────┐
│  分类错误类型   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  计算退避延迟   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     未超限   ┌─────────────────┐
│  重试次数检查   │───────────→│  设置重试定时器 │
└────────┬────────┘            └─────────────────┘
         │ 超限
         ▼
┌─────────────────┐
│  保存到离线存储 │
└─────────────────┘
```

### 3.3 异常处理实现

#### 核心处理逻辑

```typescript
// 处理失败的事件
private handleFailedEvents(failedEvents: QueuedEvent[], error?: Error): void {
  const errorType = this.classifyError(error);
  
  failedEvents.forEach(event => {
    event.retryCount++;
    
    if (event.retryCount < this.batchConfig.maxRetries) {
      // 使用优化的指数退避算法
      const backoffDelay = this.calculateBackoffDelay(event.retryCount, errorType);
      
      // 记录重试信息
      const retryRecord: RetryRecord = {
        eventId: event.id,
        retryCount: event.retryCount,
        lastRetryTime: Date.now(),
        nextRetryTime: Date.now() + backoffDelay,
        backoffDelay,
        errorType
      };
      this.retryRecords.set(event.id, retryRecord);
      
      // 清除之前的定时器（如果存在）
      const existingTimer = this.retryTimers.get(event.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // 设置新的重试定时器
      const timer = setTimeout(() => {
        this.retryTimers.delete(event.id);
        this.eventQueue.push(event);
        console.log(`事件 ${event.id} 第 ${event.retryCount} 次重试，延迟 ${backoffDelay}ms`);
      }, backoffDelay);
      
      this.retryTimers.set(event.id, timer);
    } else {
      // 超过最大重试次数，保存到离线存储
      console.warn(`事件 ${event.id} 重试次数超限（${event.retryCount}次），保存到离线存储`);
      this.retryRecords.delete(event.id);
      const existingTimer = this.retryTimers.get(event.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.retryTimers.delete(event.id);
      }
      if (this.batchConfig.enableOfflineStorage) {
        this.saveEventToOfflineStorage(event);
      }
    }
  });
}
```

### 3.4 异常场景处理

#### 场景一：网络错误

```typescript
// 网络错误处理
try {
  await sdk.flush();
} catch (error) {
  const errorType = error.message?.includes('network') ? 'network' : 'unknown';
  
  if (errorType === 'network') {
    // 网络错误，等待网络恢复
    console.warn('网络错误，事件已加入重试队列');
    
    // 可以手动检查网络状态
    await sdk.checkNetworkManually();
    const metrics = sdk.getNetworkMetrics();
    if (metrics) {
      console.log('当前网络质量:', metrics.quality);
    }
  }
}
```

#### 场景二：超时错误

```typescript
// 超时错误处理
try {
  await sdk.flush();
} catch (error) {
  if (error.message?.includes('timeout')) {
    console.warn('请求超时，事件已加入重试队列');
    
    // 超时可能是网络慢，可以减小批量大小
    const status = sdk.getAdaptiveBatchStatus();
    if (status.currentBatchSize > 20) {
      console.log('建议减小批量大小以提高成功率');
      sdk.updateBatchConfig({
        maxBatchSize: 20
      });
    }
  }
}
```

#### 场景三：服务器错误

```typescript
// 服务器错误处理
try {
  await sdk.flush();
} catch (error) {
  if (error.message?.includes('500') || error.message?.includes('502')) {
    console.error('服务器错误，事件已加入重试队列');
    
    // 服务器错误，增加重试延迟
    const retryStats = sdk.getRetryStatistics();
    if (retryStats.totalRetries > 5) {
      console.warn('服务器持续错误，建议检查服务器状态');
    }
  }
}
```

#### 场景四：客户端错误

```typescript
// 客户端错误处理（4xx）
try {
  await sdk.flush();
} catch (error) {
  if (error.message?.includes('400') || error.message?.includes('401')) {
    console.error('客户端错误，可能是数据格式问题');
    
    // 客户端错误通常不需要重试，但 SDK 会自动处理
    // 可以检查事件数据格式
    const status = sdk.getQueueStatus();
    console.log('当前队列长度:', status.queueLength);
  }
}
```

### 3.5 异常恢复机制

#### 自动恢复

```typescript
// 网络恢复时自动发送
window.addEventListener('online', () => {
  console.log('网络已恢复，自动发送离线事件');
  sdk.flush();  // 自动 flush
});

// 手动恢复
async function recoverFromError() {
  // 1. 检查网络状态
  await sdk.checkNetworkManually();
  
  // 2. 检查队列状态
  const status = sdk.getQueueStatus();
  console.log('队列长度:', status.queueLength);
  
  // 3. 检查重试记录
  const retryStats = sdk.getRetryStatistics();
  console.log('重试统计:', retryStats);
  
  // 4. 手动 flush
  if (status.queueLength > 0) {
    await sdk.flush();
  }
  
  // 5. 清除重试记录（如果需要）
  if (retryStats.totalRetries > 0) {
    sdk.clearRetryRecords();
  }
}
```

---

## 四、调试工具和最佳实践

### 4.1 完整的调试工具函数

```typescript
// 完整的 SDK 调试工具
class SDKDebugger {
  constructor(private sdk: AnalyticsSDK) {}
  
  // 打印完整状态
  printStatus(): void {
    const status = this.sdk.getQueueStatus();
    const networkMetrics = this.sdk.getNetworkMetrics();
    const adaptiveStatus = this.sdk.getAdaptiveBatchStatus();
    const retryStats = this.sdk.getRetryStatistics();
    const compressionStats = this.sdk.getCompressionStats();
    
    console.group('📊 SDK 完整状态');
    
    // 队列状态
    console.log('📦 队列状态:', {
      队列长度: status.queueLength,
      是否在线: status.isOnline,
      最大批量: status.config.maxBatchSize,
      刷新间隔: `${status.config.flushInterval}ms`
    });
    
    // 网络状况
    if (networkMetrics) {
      console.log('🌐 网络状况:', {
        RTT: `${networkMetrics.rtt.toFixed(2)}ms`,
        带宽: `${(networkMetrics.bandwidth / 1024 / 1024).toFixed(2)}Mbps`,
        质量: networkMetrics.quality,
        连接类型: networkMetrics.connectionType
      });
    }
    
    // 自适应批量
    if (adaptiveStatus.enabled) {
      console.log('⚙️ 自适应批量:', {
        当前批量大小: adaptiveStatus.currentBatchSize,
        发送成功率: `${(adaptiveStatus.recentSuccessRate * 100).toFixed(1)}%`
      });
    }
    
    // 重试统计
    if (retryStats.totalRetries > 0) {
      console.log('🔄 重试统计:', {
        总重试数: retryStats.totalRetries,
        活跃重试: retryStats.activeRetries,
        平均延迟: `${retryStats.avgBackoffDelay.toFixed(0)}ms`,
        按错误类型: retryStats.retriesByErrorType
      });
    }
    
    // 压缩统计
    if (compressionStats) {
      console.log('🗜️ 压缩统计:', {
        压缩比: `${(compressionStats.compressionRatio * 100).toFixed(1)}%`,
        原始大小: `${(compressionStats.originalSize / 1024).toFixed(2)}KB`,
        压缩后大小: `${(compressionStats.compressedSize / 1024).toFixed(2)}KB`
      });
    }
    
    console.groupEnd();
  }
  
  // 监控模式
  startMonitoring(interval: number = 5000): () => void {
    console.log('开始监控 SDK 状态...');
    
    const timer = setInterval(() => {
      this.printStatus();
    }, interval);
    
    // 返回停止函数
    return () => {
      clearInterval(timer);
      console.log('停止监控');
    };
  }
  
  // 诊断问题
  async diagnose(): Promise<void> {
    console.group('🔍 SDK 问题诊断');
    
    const status = this.sdk.getQueueStatus();
    const networkMetrics = this.sdk.getNetworkMetrics();
    const retryStats = this.sdk.getRetryStatistics();
    
    // 检查队列积压
    if (status.queueLength > 100) {
      console.warn('⚠️ 队列积压严重:', status.queueLength);
      console.log('建议: 手动 flush 或检查网络状况');
    }
    
    // 检查网络状况
    if (networkMetrics && networkMetrics.quality === 'poor') {
      console.warn('⚠️ 网络状况不佳:', networkMetrics.quality);
      console.log('建议: 等待网络恢复或减小批量大小');
    }
    
    // 检查重试过多
    if (retryStats.totalRetries > 10) {
      console.warn('⚠️ 重试次数过多:', retryStats.totalRetries);
      console.log('建议: 检查服务器状态或网络连接');
    }
    
    // 检查离线状态
    if (!status.isOnline) {
      console.warn('⚠️ 当前离线');
      console.log('建议: 等待网络恢复，事件已保存到离线存储');
    }
    
    console.groupEnd();
  }
  
  // 强制恢复
  async forceRecover(): Promise<void> {
    console.log('开始强制恢复...');
    
    // 1. 检查网络
    await this.sdk.checkNetworkManually();
    
    // 2. 清除重试记录
    this.sdk.clearRetryRecords();
    
    // 3. 手动 flush
    await this.sdk.flush();
    
    // 4. 打印状态
    this.printStatus();
    
    console.log('恢复完成');
  }
}

// 使用示例
const debugger = new SDKDebugger(sdk);

// 打印状态
debugger.printStatus();

// 开始监控
const stopMonitoring = debugger.startMonitoring(5000);

// 诊断问题
await debugger.diagnose();

// 强制恢复
await debugger.forceRecover();
```

### 4.2 开发环境集成

#### React 开发工具

```typescript
// 在 React 开发环境中
if (process.env.NODE_ENV === 'development') {
  // 将 SDK 挂载到 window，方便调试
  (window as any).__SDK_DEBUG__ = {
    sdk,
    flush: () => sdk.flush(),
    status: () => sdk.getQueueStatus(),
    network: () => sdk.getNetworkMetrics(),
    retry: () => sdk.getRetryStatistics(),
    debug: () => {
      const debugger = new SDKDebugger(sdk);
      debugger.printStatus();
    }
  };
  
  console.log('SDK 调试工具已挂载到 window.__SDK_DEBUG__');
}
```

**在控制台使用：**
```javascript
// 查看状态
__SDK_DEBUG__.status()

// 手动 flush
await __SDK_DEBUG__.flush()

// 完整调试信息
__SDK_DEBUG__.debug()
```

### 4.3 最佳实践

#### 1. 开发时使用手动 flush

```typescript
// 开发环境配置
const devConfig = {
  maxBatchSize: 10,        // 开发时使用小批量
  flushInterval: 1000,    // 1秒刷新一次
  enableOfflineStorage: false  // 开发时禁用离线存储
};

const sdk = AnalyticsSDK.getInstance('project-id', 'endpoint', 
  process.env.NODE_ENV === 'development' ? devConfig : undefined
);

// 开发时立即发送
if (process.env.NODE_ENV === 'development') {
  sdk.track('test_event', { test: true });
  await sdk.flush();
}
```

#### 2. 关键操作后立即上报

```typescript
// 关键操作立即上报
async function criticalAction() {
  try {
    // 执行关键操作
    await doSomething();
    
    // 立即上报
    sdk.track('critical_action', { result: 'success' });
    await sdk.flush();
  } catch (error) {
    sdk.trackError('critical_action_failed', { error: error.message });
    await sdk.flush();
  }
}
```

#### 3. 异常情况下的处理

```typescript
// 异常情况处理
async function handleException() {
  try {
    await sdk.flush();
  } catch (error) {
    // 记录错误
    console.error('Flush 失败:', error);
    
    // 检查状态
    const status = sdk.getQueueStatus();
    const retryStats = sdk.getRetryStatistics();
    
    // 如果重试过多，可能需要人工干预
    if (retryStats.totalRetries > 10) {
      console.warn('重试过多，建议检查网络或服务器');
    }
    
    // 如果队列积压，可能需要调整配置
    if (status.queueLength > 100) {
      console.warn('队列积压，建议减小批量大小或增加刷新间隔');
    }
  }
}
```

---

## 五、总结

### 5.1 手动 Flush 的优势

- ✅ **即时反馈**：开发调试时立即看到效果
- ✅ **关键事件保证**：重要操作后立即上报
- ✅ **测试友好**：测试中可以控制发送时机
- ✅ **异常恢复**：异常情况下可以手动触发发送

### 5.2 调试能力的价值

- ✅ **问题定位**：快速定位埋点链路问题
- ✅ **性能监控**：实时监控 SDK 性能指标
- ✅ **异常诊断**：自动诊断常见问题
- ✅ **状态可视化**：清晰展示 SDK 内部状态

### 5.3 异常处理策略

- ✅ **分类处理**：根据错误类型采用不同策略
- ✅ **自动重试**：指数退避重试机制
- ✅ **降级方案**：失败时保存到离线存储
- ✅ **恢复机制**：网络恢复后自动发送

通过手动 flush 和完整的调试能力，开发者可以更好地控制埋点数据的上报，快速定位和解决问题，提高开发效率和系统可靠性。

