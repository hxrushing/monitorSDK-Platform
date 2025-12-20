# 离线缓存压缩与 Beacon 兜底机制设计说明

## 📋 概述

本文档详细说明 SDK 在弱网环境下如何处理埋点数据上报，包括离线缓存机制、数据压缩策略和 Beacon API 兜底方案的设计实现、注意事项和最佳实践。

---

## 一、弱网环境下的处理策略

### 1.1 弱网环境识别

SDK 通过以下方式识别弱网环境：

```typescript
// 网络质量评估
private evaluateNetworkQuality(rtt: number, bandwidth: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (rtt < 50 && bandwidth > 5 * 1024 * 1024) {
    return 'excellent';
  } else if (rtt < 100 && bandwidth > 1 * 1024 * 1024) {
    return 'good';
  } else if (rtt < 300 && bandwidth > 100 * 1024) {
    return 'fair';
  } else {
    return 'poor';  // 弱网环境
  }
}
```

**弱网环境特征：**
- RTT ≥ 300ms
- 带宽 ≤ 100KBps
- 连接类型为 2G、3G 或未知

### 1.2 弱网环境下的处理流程

```
┌─────────────────┐
│  事件产生       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  加入队列       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     是      ┌─────────────────┐
│  网络在线？     │───────────→│  尝试发送        │
└────────┬────────┘            └────────┬────────┘
         │ 否                              │
         ▼                                  │ 失败
┌─────────────────┐                        │
│  保存到离线存储 │                        │
└────────┬────────┘                        │
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  压缩数据        │
              └────────┬────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  存储到localStorage│
              └──────────────────┘
```

### 1.3 弱网环境下的自适应策略

#### 1. 批量大小自动减小

```typescript
// 网络质量 poor 时，批量大小减少 50%
const qualityMultiplier = {
  excellent: 1.5,
  good: 1.2,
  fair: 0.8,
  poor: 0.5  // 弱网时批量大小减半
};
```

**效果：**
- ✅ 减少单次请求数据量
- ✅ 降低请求超时概率
- ✅ 提高发送成功率

#### 2. 重试延迟自动增加

```typescript
// 网络质量 poor 时，重试延迟增加 50%
const networkMultiplier = {
  excellent: 0.8,
  good: 0.9,
  fair: 1.1,
  poor: 1.5  // 弱网时延迟增加 50%
};
```

**效果：**
- ✅ 给网络更多恢复时间
- ✅ 避免频繁重试造成资源浪费
- ✅ 提高最终成功率

#### 3. 自动保存到离线存储

```typescript
// 网络离线或发送失败时，自动保存到离线存储
if (!this.isOnline && this.batchConfig.enableOfflineStorage) {
  this.saveToOfflineStorage();
  return;
}
```

---

## 二、离线缓存机制

### 2.1 设计目标

离线缓存机制旨在：
- ✅ **数据不丢失**：网络断开时保存事件到本地
- ✅ **自动恢复**：网络恢复后自动发送离线事件
- ✅ **存储优化**：通过压缩减少存储空间
- ✅ **容量管理**：限制存储大小，防止溢出

### 2.2 存储流程

#### 保存到离线存储

```typescript
private saveToOfflineStorage(): void {
  if (!this.batchConfig.enableOfflineStorage) return;

  try {
    // 1. 获取现有事件
    const existingEvents = this.getOfflineEvents();
    const allEvents = [...existingEvents, ...this.eventQueue];
    
    // 2. 检查存储大小限制
    let eventsToStore = this.limitStorageSize(allEvents);
    
    // 3. 优化和压缩数据
    const compressedData = this.compressData(eventsToStore);
    
    // 4. 保存到 localStorage
    localStorage.setItem(this.storageKey, compressedData);
    
    // 5. 清空队列
    this.eventQueue = [];
  } catch (error) {
    // 压缩失败，尝试不压缩保存
    try {
      const eventsToStore = this.limitStorageSize(allEvents);
      localStorage.setItem(this.storageKey, JSON.stringify(eventsToStore));
    } catch (fallbackError) {
      console.error('保存到离线存储失败（回退方案）:', fallbackError);
    }
  }
}
```

#### 加载离线事件

```typescript
private loadOfflineEvents(): void {
  if (!this.batchConfig.enableOfflineStorage) return;

  try {
    const offlineEvents = this.getOfflineEvents();
    if (offlineEvents.length > 0) {
      // 1. 加载到队列
      this.eventQueue.push(...offlineEvents);
      
      // 2. 清空离线存储
      localStorage.removeItem(this.storageKey);
      
      // 3. 如果在线，立即尝试发送
      if (this.isOnline) {
        this.flushQueue();
      }
    }
  } catch (error) {
    console.error('加载离线事件失败:', error);
  }
}
```

### 2.3 存储大小限制

```typescript
private limitStorageSize(events: QueuedEvent[]): QueuedEvent[] {
  // 粗略估算：每个事件约 1000 字节
  const maxEvents = Math.floor(this.batchConfig.maxStorageSize / 1000);
  
  // 保留最近的事件，删除旧事件
  return events.slice(-maxEvents);
}
```

**默认配置：**
- `maxStorageSize: 1024 * 1024` (1MB)
- 约可存储 1000 个事件（未压缩）
- 压缩后约可存储 3000-5000 个事件

### 2.4 存储键名管理

```typescript
// 每个项目使用独立的存储键
this.storageKey = `analytics_events_${projectId}`;
```

**优势：**
- ✅ 多项目隔离，避免数据混淆
- ✅ 便于清理和管理
- ✅ 支持多实例共存

### 2.5 网络状态监听

```typescript
// 监听网络状态变化
window.addEventListener('online', () => {
  this.isOnline = true;
  console.log('网络已连接，开始发送离线事件');
  
  // 网络恢复时立即检测网络状况
  if (this.batchConfig.adaptive?.enabled) {
    this.checkNetworkStatus();
  }
  
  // 立即尝试发送离线事件
  this.flushQueue();
});

window.addEventListener('offline', () => {
  this.isOnline = false;
  console.log('网络已断开，事件将存储到本地');
  
  // 网络断开时重置网络指标
  if (this.networkMetrics) {
    this.networkMetrics.quality = 'poor';
  }
});
```

---

## 三、数据压缩机制

### 3.1 压缩目标

数据压缩旨在：
- ✅ **减少存储空间**：压缩后存储更多事件
- ✅ **降低传输成本**：减少网络传输数据量
- ✅ **提高性能**：减少 localStorage 读写时间

### 3.2 压缩算法选择

```typescript
// 自动选择最佳压缩算法
const algorithmToUse = compressionConfig.algorithm === 'auto' 
  ? (this.compressionSupported.native ? 'native' : 'custom')
  : compressionConfig.algorithm;
```

**算法优先级：**
1. **原生压缩**（如果支持）：浏览器原生 CompressionStream API
2. **自定义压缩**（回退方案）：JSON 优化 + 数据去重 + 字典压缩

### 3.3 自定义压缩算法

#### 1. JSON 优化

```typescript
// 移除不必要的空格和换行
if (config.optimizeJson) {
  const parsed = JSON.parse(data);
  compressed = JSON.stringify(parsed);  // 紧凑格式
}
```

**效果：**
- 减少 10-20% 的数据大小
- 几乎无性能开销

#### 2. 数据去重

```typescript
private deduplicateData(jsonString: string): string {
  const data = JSON.parse(jsonString);
  
  // 提取所有事件的公共字段
  const commonFields: Record<string, any> = {};
  const firstEvent = data[0];
  
  // 找出所有事件都相同的字段
  Object.keys(firstEvent.data || {}).forEach(key => {
    const value = firstEvent.data[key];
    if (data.every(event => event.data?.[key] === value)) {
      commonFields[key] = value;
    }
  });
  
  // 优化数据结构：公共字段提取到 _common
  if (Object.keys(commonFields).length > 0) {
    const optimized = {
      _common: commonFields,
      _events: data.map(event => {
        const optimizedEvent = { ...event };
        // 从每个事件中删除公共字段
        Object.keys(commonFields).forEach(key => {
          delete optimizedEvent.data[key];
        });
        return optimizedEvent;
      })
    };
    return JSON.stringify(optimized);
  }
  
  return jsonString;
}
```

**示例：**

**压缩前：**
```json
[
  {
    "id": "1",
    "data": {
      "projectId": "project-123",
      "deviceInfo": { "ua": "Chrome" },
      "eventName": "page_view",
      "page": "/home"
    }
  },
  {
    "id": "2",
    "data": {
      "projectId": "project-123",
      "deviceInfo": { "ua": "Chrome" },
      "eventName": "click",
      "button": "submit"
    }
  }
]
```

**压缩后：**
```json
{
  "_common": {
    "projectId": "project-123",
    "deviceInfo": { "ua": "Chrome" }
  },
  "_events": [
    {
      "id": "1",
      "data": {
        "eventName": "page_view",
        "page": "/home"
      }
    },
    {
      "id": "2",
      "data": {
        "eventName": "click",
        "button": "submit"
      }
    }
  ]
}
```

**压缩效果：**
- 100 个事件，每个包含 200 字节公共字段
- 压缩前：100 × 200 = 20,000 字节
- 压缩后：200 + 100 × 50 = 5,200 字节
- **压缩比：74% 减少**

#### 3. 字典压缩

```typescript
private compressString(str: string, _level: number): string {
  const patterns = new Map<string, string>();
  let patternId = 0;
  
  // 查找长度大于 10 的重复子串
  for (let len = 20; len >= 10; len--) {
    const frequency = new Map<string, number>();
    
    // 统计子串出现频率
    for (let i = 0; i <= str.length - len; i++) {
      const substr = str.substring(i, i + len);
      frequency.set(substr, (frequency.get(substr) || 0) + 1);
    }
    
    // 替换出现 3 次以上的子串
    frequency.forEach((count, substr) => {
      if (count >= 3 && !patterns.has(substr)) {
        const id = `__P${patternId++}__`;
        patterns.set(substr, id);
        str = str.split(substr).join(id);
      }
    });
  }
  
  // 如果有模式替换，添加字典
  if (patterns.size > 0) {
    const dict: Record<string, string> = {};
    patterns.forEach((id, pattern) => {
      dict[id] = pattern;
    });
    return `__DICT__${JSON.stringify(dict)}__DATA__${str}`;
  }
  
  return str;
}
```

**示例：**

**压缩前：**
```
"projectId": "project-123", "projectId": "project-123", "projectId": "project-123"
```

**压缩后：**
```
__DICT__{"__P0__":"projectId\": \"project-123\""}__DATA__"__P0__", "__P0__", "__P0__"
```

### 3.4 压缩数据格式

```typescript
// 压缩数据格式
`__COMPRESSED__${algorithm}__${compressedData}`

// 示例
"__COMPRESSED__custom____DICT__{...}__DATA__..."
```

**格式说明：**
- `__COMPRESSED__`：压缩标记前缀
- `custom`：压缩算法标识
- 后续为实际压缩数据

### 3.5 解压缩流程

```typescript
private decompressData(compressed: string): QueuedEvent[] {
  // 1. 检查是否是压缩数据
  if (!compressed.startsWith('__COMPRESSED__')) {
    return JSON.parse(compressed);  // 未压缩数据
  }
  
  // 2. 提取压缩算法和数据
  const match = compressed.match(/^__COMPRESSED__(native-gzip|custom)__(.+)$/);
  if (!match) {
    return JSON.parse(compressed);  // 格式错误，尝试直接解析
  }
  
  const algorithm = match[1];
  const data = match[2];
  
  // 3. 根据算法解压
  let decompressed: string;
  if (algorithm === 'native-gzip') {
    decompressed = this.decompressWithNative(data);
  } else {
    decompressed = this.decompressWithCustom(data);
  }
  
  // 4. 解析 JSON
  return JSON.parse(decompressed);
}
```

### 3.6 压缩统计

```typescript
interface CompressionStats {
  originalSize: number;       // 原始大小（字节）
  compressedSize: number;     // 压缩后大小（字节）
  compressionRatio: number;   // 压缩比
  algorithm: string;          // 使用的压缩算法
  compressionTime: number;    // 压缩耗时（毫秒）
  decompressionTime: number;  // 解压耗时（毫秒）
}
```

**获取压缩统计：**
```typescript
const stats = sdk.getCompressionStats();
console.log('压缩比:', (stats.compressionRatio * 100).toFixed(1) + '%');
console.log('原始大小:', stats.originalSize, '字节');
console.log('压缩后大小:', stats.compressedSize, '字节');
```

### 3.7 压缩配置

```typescript
interface CompressionConfig {
  enabled: boolean;            // 是否启用压缩（默认: true）
  algorithm: 'auto' | 'native' | 'custom' | 'none'; // 压缩算法
  minSize: number;            // 最小压缩大小（字节，默认: 100）
  compressionLevel: number;    // 压缩级别 0-9（默认: 6）
  deduplicate: boolean;       // 是否启用去重（默认: true）
  optimizeJson: boolean;       // 是否优化JSON结构（默认: true）
}
```

**配置建议：**
- **弱网环境**：启用压缩，使用 `custom` 算法（兼容性好）
- **存储受限**：启用压缩，提高 `compressionLevel`
- **性能优先**：使用 `auto`，让 SDK 自动选择

---

## 四、Beacon API 兜底机制

### 4.1 Beacon API 简介

Beacon API 是专门为在页面关闭时发送数据而设计的浏览器 API，具有以下特性：

- ✅ **不阻塞页面卸载**：异步发送，保证用户体验
- ✅ **可靠传输**：浏览器保证数据发送完成，即使页面已关闭
- ✅ **自动重试**：浏览器内部处理重试逻辑
- ✅ **低优先级**：不影响页面性能

### 4.2 使用场景

SDK 在以下场景自动使用 Beacon API：

#### 1. 页面关闭时（`beforeunload`）

```typescript
window.addEventListener('beforeunload', () => {
  this.flushQueueWithBeacon();
});
```

#### 2. 页面隐藏时（`pagehide`）

```typescript
window.addEventListener('pagehide', (event) => {
  // 如果页面被缓存（bfcache），不使用 Beacon
  if (event.persisted) {
    return;
  }
  this.flushQueueWithBeacon();
});
```

#### 3. 移动端页面隐藏时（`visibilitychange`）

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (this.beaconSupported && this.eventQueue.length > 0) {
      this.flushQueueWithBeacon();
    } else {
      this.flushQueue();
    }
  }
});
```

### 4.3 实现细节

#### 核心实现

```typescript
private flushQueueWithBeacon(): void {
  if (this.eventQueue.length === 0) {
    return;
  }

  // 1. 检查 Beacon API 支持
  if (!this.beaconSupported) {
    console.warn('[SDK] Beacon API 不支持，回退到同步发送');
    this.flushQueue(true);
    return;
  }

  // 2. 准备所有待发送的事件
  const eventsToSend = [...this.eventQueue];
  this.eventQueue = []; // 清空队列

  // 3. 准备批量数据
  const batchData = {
    projectId: this.projectId,
    events: eventsToSend.map(event => event.data),
    batchSize: eventsToSend.length,
    timestamp: Date.now(),
    ...this.commonParams
  };

  try {
    // 4. 将数据转换为 Blob
    const blob = new Blob([JSON.stringify(batchData)], {
      type: 'application/json'
    });

    // 5. 使用 Beacon API 发送数据
    const sent = navigator.sendBeacon(this.endpoint, blob);

    if (sent) {
      console.log(`[SDK] 使用 Beacon API 成功发送 ${eventsToSend.length} 个事件`);
    } else {
      // 6. 发送失败，保存到离线存储
      console.warn(`[SDK] Beacon API 发送失败，事件已保存到离线存储`);
      if (this.batchConfig.enableOfflineStorage) {
        eventsToSend.forEach(event => {
          this.saveEventToOfflineStorage(event);
        });
      }
    }
  } catch (error) {
    console.error('[SDK] Beacon API 发送异常:', error);
    // 异常时也保存到离线存储
    if (this.batchConfig.enableOfflineStorage) {
      eventsToSend.forEach(event => {
        this.saveEventToOfflineStorage(event);
      });
    }
  }
}
```

#### 手动使用

```typescript
public sendWithBeacon(eventName: string, eventParams?: Record<string, any>): boolean {
  if (!this.beaconSupported) {
    this.track(eventName, eventParams);
    return false;
  }

  const event: TrackEvent = {
    eventName,
    eventParams,
    timestamp: Date.now(),
  };

  const batchData = {
    projectId: this.projectId,
    events: [eventData],
    batchSize: 1,
    timestamp: Date.now(),
    ...this.commonParams
  };

  try {
    const blob = new Blob([JSON.stringify(batchData)], {
      type: 'application/json'
    });

    const sent = navigator.sendBeacon(this.endpoint, blob);
    
    if (!sent) {
      // 发送失败，加入队列
      this.addToQueue(eventData, 'high');
    }

    return sent;
  } catch (error) {
    // 异常时加入队列
    this.addToQueue(eventData, 'high');
    return false;
  }
}
```

### 4.4 重要注意事项

#### ⚠️ 1. 数据大小限制

**限制：**
- Beacon API 有数据大小限制，通常为 **64KB**
- 超过限制时，`sendBeacon()` 返回 `false`

**处理方案：**
```typescript
// 检查数据大小
const blob = new Blob([JSON.stringify(batchData)]);
if (blob.size > 64 * 1024) {
  // 数据过大，分批发送或保存到离线存储
  console.warn('数据过大，保存到离线存储');
  this.saveToOfflineStorage();
  return;
}
```

**建议：**
- ✅ 控制单个事件大小（建议 < 1KB）
- ✅ 控制批量大小，避免单次发送过多事件
- ✅ 数据过大时自动保存到离线存储

#### ⚠️ 2. CORS 配置

**要求：**
- 服务器必须支持 CORS
- 必须允许 `POST` 方法和 `application/json` Content-Type

**服务器配置示例（Node.js）：**
```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

#### ⚠️ 3. 浏览器支持

| 浏览器 | 版本要求 | 支持情况 |
|--------|---------|---------|
| Chrome | 39+ | ✅ 完全支持 |
| Firefox | 31+ | ✅ 完全支持 |
| Safari | 11.1+ | ✅ 完全支持 |
| Edge | 14+ | ✅ 完全支持 |
| Opera | 26+ | ✅ 完全支持 |
| IE | 不支持 | ❌ 需要回退方案 |

**检测支持：**
```typescript
private beaconSupported: boolean = 
  typeof navigator !== 'undefined' && 'sendBeacon' in navigator;
```

**回退方案：**
```typescript
if (!this.beaconSupported) {
  // 回退到同步发送（可能被取消）
  this.flushQueue(true);
}
```

#### ⚠️ 4. 无法获取响应

**限制：**
- Beacon API 是"发送即忘记"的 API
- 无法获取 HTTP 响应状态码
- 无法获取响应内容

**影响：**
- ❌ 无法确认数据是否成功接收
- ❌ 无法处理服务器错误响应
- ✅ 但浏览器保证数据会发送

**处理方案：**
- ✅ 发送失败时保存到离线存储
- ✅ 网络恢复后重新发送
- ✅ 服务器端记录日志，便于排查

#### ⚠️ 5. bfcache 处理

**问题：**
- 页面可能被浏览器缓存（bfcache）
- 缓存的页面不会触发 `beforeunload`
- 但会触发 `pagehide` 事件

**处理：**
```typescript
window.addEventListener('pagehide', (event) => {
  // 检查页面是否被缓存
  if (event.persisted) {
    // 页面被缓存，不使用 Beacon（下次访问时会恢复）
    return;
  }
  // 页面真正关闭，使用 Beacon
  this.flushQueueWithBeacon();
});
```

#### ⚠️ 6. Content-Type 设置

**注意：**
- Beacon API 发送 Blob 时，会自动设置 `Content-Type`
- 使用 `application/json` 类型时，服务器需要正确解析

**实现：**
```typescript
const blob = new Blob([JSON.stringify(batchData)], {
  type: 'application/json'  // 明确指定类型
});
```

#### ⚠️ 7. 异步特性

**特点：**
- Beacon API 是异步的，立即返回
- 返回 `true` 表示已加入发送队列
- 实际发送在后台进行

**影响：**
- ✅ 不阻塞页面卸载
- ⚠️ 无法立即确认发送结果
- ✅ 浏览器保证发送完成

### 4.5 最佳实践

#### 1. 关键事件使用 Beacon

```typescript
// 页面浏览等关键事件
sdk.sendWithBeacon('page_view', {
  path: window.location.pathname,
  title: document.title
});
```

#### 2. 控制数据大小

```typescript
// 检查数据大小
const dataSize = new Blob([JSON.stringify(batchData)]).size;
if (dataSize > 60 * 1024) {  // 60KB 阈值
  // 分批发送或保存到离线存储
}
```

#### 3. 错误处理

```typescript
const sent = sdk.sendWithBeacon('event', data);
if (!sent) {
  // 发送失败，使用普通方式
  sdk.track('event', data, 'high');
}
```

#### 4. 监控和调试

```typescript
// 检查 Beacon 支持
if (sdk.isBeaconSupported()) {
  console.log('Beacon API 支持');
} else {
  console.warn('Beacon API 不支持，使用回退方案');
}

// 监控发送状态（通过控制台日志）
// 成功: [SDK] 使用 Beacon API 成功发送 X 个事件
// 失败: [SDK] Beacon API 发送失败，事件已保存到离线存储
```

---

## 五、完整流程示例

### 5.1 弱网环境下的完整流程

```
场景：用户在弱网环境下使用应用

1. 用户操作触发事件
   ↓
2. 事件加入队列
   ↓
3. 检测网络状况（poor）
   ↓
4. 批量大小自动减小（50%）
   ↓
5. 尝试发送（失败）
   ↓
6. 指数退避重试（延迟增加 50%）
   ↓
7. 重试失败，保存到离线存储
   ↓
8. 数据压缩（减少 70% 存储空间）
   ↓
9. 存储到 localStorage
   ↓
10. 网络恢复
    ↓
11. 自动加载离线事件
    ↓
12. 自动发送离线事件
    ↓
13. 发送成功，清空离线存储
```

### 5.2 页面关闭时的完整流程

```
场景：用户关闭页面，队列中还有未发送的事件

1. 触发 beforeunload 事件
   ↓
2. 检查 Beacon API 支持
   ↓
3. 准备批量数据
   ↓
4. 检查数据大小（< 64KB）
   ↓
5. 转换为 Blob
   ↓
6. 调用 sendBeacon()
   ↓
7. 返回 true（成功加入发送队列）
   ↓
8. 页面正常关闭
   ↓
9. 浏览器后台发送数据
   ↓
10. 如果发送失败，保存到离线存储（下次访问时发送）
```

---

## 六、性能优化建议

### 6.1 存储优化

1. **启用压缩**：减少 70% 存储空间
2. **限制存储大小**：防止 localStorage 溢出
3. **定期清理**：删除过期事件

### 6.2 网络优化

1. **自适应批量**：弱网时减小批量大小
2. **指数退避**：避免频繁重试
3. **压缩传输**：减少网络传输量

### 6.3 用户体验优化

1. **异步处理**：不阻塞用户操作
2. **Beacon 兜底**：页面关闭时保证数据发送
3. **自动恢复**：网络恢复后自动发送

---

## 七、监控和调试

### 7.1 监控指标

```typescript
// 队列状态
const status = sdk.getQueueStatus();
console.log('队列长度:', status.queueLength);
console.log('是否在线:', status.isOnline);

// 压缩统计
const compressionStats = sdk.getCompressionStats();
if (compressionStats) {
  console.log('压缩比:', (compressionStats.compressionRatio * 100).toFixed(1) + '%');
}

// 网络状况
const networkMetrics = sdk.getNetworkMetrics();
if (networkMetrics) {
  console.log('网络质量:', networkMetrics.quality);
  console.log('RTT:', networkMetrics.rtt, 'ms');
}
```

### 7.2 调试技巧

1. **查看离线存储**：
```typescript
// 在控制台查看
localStorage.getItem('analytics_events_project-id');
```

2. **检查 Beacon 发送**：
   - 打开 Network 面板
   - 过滤 `beacon` 类型请求
   - 查看请求状态

3. **模拟弱网环境**：
   - Chrome DevTools → Network → Throttling
   - 选择 "Slow 3G" 或 "Offline"

---

## 八、总结

### 8.1 核心机制

1. **离线缓存**：网络断开时自动保存，恢复后自动发送
2. **数据压缩**：减少 70% 存储空间，提高存储效率
3. **Beacon 兜底**：页面关闭时保证数据发送，不阻塞页面卸载

### 8.2 关键注意事项

1. **Beacon API 数据大小限制**：64KB，需要控制批量大小
2. **CORS 配置**：服务器必须支持 CORS
3. **浏览器兼容性**：IE 不支持，需要回退方案
4. **无法获取响应**：无法确认发送结果，需要服务器端日志

### 8.3 最佳实践

1. **弱网环境**：启用压缩，减小批量大小，增加重试延迟
2. **关键事件**：使用 Beacon API 确保发送
3. **数据大小**：控制单个事件和批量大小
4. **错误处理**：发送失败时保存到离线存储

该设计在弱网环境下能够有效保证数据不丢失，通过压缩和 Beacon 兜底机制，提供了可靠的数据上报方案。

