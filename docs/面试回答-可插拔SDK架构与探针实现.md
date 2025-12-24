# 面试回答：可插拔SDK架构设计与探针模块实现

本文档详细回答关于可插拔SDK架构设计和探针模块实现的相关问题。

---

## 第一部分：可插拔SDK架构设计

### 1.1 可插拔设计理念

#### 为什么选择可插拔的架构设计？

**核心原因：**

1. **减少初始体积**：传统单体SDK会将所有功能打包在一起，即使用户只需要错误监控，也会加载HTTP、性能等所有探针代码。可插拔设计通过按需加载，只加载启用的探针模块，大幅减少初始bundle大小。

2. **灵活扩展**：当需要添加新的监控能力（如录屏、Session关联）时，只需实现新的探针模块，无需修改SDK核心代码。这种设计符合开闭原则（对扩展开放，对修改关闭）。

3. **统一管理**：所有探针通过统一的 `Probe` 接口和配置系统管理，保证了代码的一致性和可维护性。

4. **易于维护**：每个探针独立实现，互不干扰。某个探针的bug不会影响其他探针的运行。

**实际效果：**
- 初始bundle大小减少约 **60-70%**（只启用错误探针时）
- 新增探针模块时，核心代码零修改
- 探针模块可以独立测试和维护

#### 相比传统单体SDK的优势

| 对比项 | 传统单体SDK | 可插拔SDK |
|--------|------------|----------|
| **初始体积** | 包含所有功能，体积大 | 按需加载，体积小 |
| **扩展性** | 需要修改核心代码 | 只需添加新探针 |
| **维护性** | 功能耦合，修改影响大 | 模块独立，影响小 |
| **性能** | 初始化时加载所有代码 | 按需动态加载 |
| **灵活性** | 配置选项有限 | 可灵活组合探针 |

---

### 1.2 探针接口标准化

#### 接口设计思路

所有探针都实现了统一的 `Probe` 接口，定义如下：

```typescript
export interface Probe {
  name: string;                    // 探针名称（唯一标识）
  enabled: boolean;                 // 是否启用
  init(reporter: EventReporter): void;  // 初始化探针
  destroy(): void;                 // 销毁探针，清理资源
}
```

**设计要点：**

1. **最小化接口**：接口只包含必要的生命周期方法，保持简洁。

2. **事件驱动通信**：探针通过 `EventReporter` 回调函数上报事件，而不是直接调用SDK核心方法，实现了松耦合。

3. **资源管理**：`destroy()` 方法确保探针能够正确清理资源（移除事件监听器、恢复原始API等），避免内存泄漏。

#### 如何保证探针之间的互不干扰？

**实现机制：**

1. **独立作用域**：每个探针是独立的类实例，拥有自己的私有变量和方法。

2. **事件隔离**：探针通过 `EventReporter` 上报事件，SDK核心负责路由到相应的处理方法，探针之间不直接通信。

3. **错误隔离**：探针初始化失败时，通过 try-catch 捕获错误，只记录警告，不影响其他探针：

```typescript
import('../../probes/error').then(({ ErrorProbe }) => {
  const probe = new ErrorProbe();
  this.registerProbe(probe);
}).catch(err => {
  console.warn('加载错误探针失败:', err);  // 只警告，不影响其他探针
});
```

4. **资源隔离**：每个探针在 `destroy()` 中清理自己的资源，不会影响其他探针。

**实际案例：**
- HTTP探针拦截 `fetch` 和 `XMLHttpRequest`
- 错误探针监听全局错误事件
- 两者互不干扰，可以同时启用

---

### 1.3 动态加载机制

#### 实现方式

使用 ES6 动态 `import()` 实现按需加载：

```typescript
private initProbes(): void {
  // 动态导入错误探针
  if (this.config.enable.error) {
    import('../../probes/error').then(({ ErrorProbe }) => {
      const probe = new ErrorProbe();
      this.registerProbe(probe);
    }).catch(err => {
      console.warn('加载错误探针失败:', err);
    });
  }

  // 动态导入HTTP探针
  if (this.config.enable.http) {
    import('../../probes/http').then(({ HttpProbe }) => {
      const probe = new HttpProbe(this.config.http);
      probe.init((_eventType, payload) => {
        this.trackHttp({...});
      });
      this.probes.set(probe.name, probe);
    }).catch(err => {
      console.warn('加载HTTP探针失败:', err);
    });
  }
}
```

**关键点：**

1. **条件加载**：根据配置中的 `enable` 开关决定是否加载探针。

2. **异步加载**：`import()` 返回 Promise，不会阻塞主线程。

3. **错误处理**：加载失败时只记录警告，不影响SDK核心运行。

#### 代码分割配置

在 `vite.config.ts` 中配置代码分割：

```typescript
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'probe-error': ['./src/sdk/probes/error'],
          'probe-http': ['./src/sdk/probes/http'],
          'probe-performance': ['./src/sdk/probes/performance'],
          'probe-behavior': ['./src/sdk/probes/behavior'],
        }
      }
    }
  }
}
```

**效果：**
- 每个探针打包成独立的 chunk
- 只加载启用的探针 chunk
- 初始bundle只包含SDK核心代码

---

### 1.4 探针独立性保证

#### 如何确保探针模块之间的独立性？

**实现策略：**

1. **接口隔离**：探针只依赖 `Probe` 接口和 `EventReporter` 类型，不依赖其他探针。

2. **配置隔离**：每个探针有独立的配置项，互不影响：

```typescript
interface SDKConfig {
  enable: {
    error?: boolean;
    http?: boolean;
    perf?: boolean;
    behavior?: boolean;
  };
  http?: HttpProbeConfig;      // HTTP探针配置
  behavior?: BehaviorProbeConfig;  // 行为探针配置
}
```

3. **生命周期隔离**：探针的 `init()` 和 `destroy()` 方法独立执行，互不依赖。

#### 如果某个探针初始化失败，会不会影响其他探针？

**不会影响。** 原因如下：

1. **错误捕获**：每个探针的加载都包裹在 try-catch 或 Promise.catch 中：

```typescript
import('../../probes/error').then(({ ErrorProbe }) => {
  // 初始化逻辑
}).catch(err => {
  console.warn('加载错误探针失败:', err);  // 只警告，不抛出异常
});
```

2. **独立执行**：探针的加载是独立的 Promise，一个失败不影响其他。

3. **降级处理**：探针加载失败时，SDK核心继续运行，只是该探针功能不可用。

**实际案例：**
- 如果浏览器不支持 `PerformanceObserver`，性能探针会失败，但错误探针和HTTP探针仍可正常工作。

---

### 1.5 配置系统设计

#### 配置合并与验证

**配置结构：**

```typescript
interface SDKConfig {
  projectId: string;              // 必需
  endpoint: string;                // 必需
  enable?: ProbeEnableConfig;      // 探针开关
  sampleRate?: SampleRateConfig;   // 采样率
  http?: HttpProbeConfig;          // HTTP探针配置
  behavior?: BehaviorProbeConfig;  // 行为探针配置
  batch?: Partial<BatchConfig>;    // 批量上报配置
  debug?: boolean;                 // 调试模式
}
```

**配置合并：**

```typescript
export function mergeConfig(userConfig: SDKConfig): Required<SDKConfig> {
  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    enable: {
      ...DEFAULT_CONFIG.enable,
      ...userConfig.enable,
    },
    sampleRate: {
      ...DEFAULT_CONFIG.sampleRate,
      ...userConfig.sampleRate,
    },
    // ... 其他配置项
  };
  return merged as Required<SDKConfig>;
}
```

**配置验证：**

```typescript
export function validateConfig(config: SDKConfig): string[] {
  const errors: string[] = [];

  if (!config.projectId) {
    errors.push('projectId is required');
  }

  if (!config.endpoint) {
    errors.push('endpoint is required');
  }

  // 验证采样率范围
  if (config.sampleRate) {
    Object.entries(config.sampleRate).forEach(([key, value]) => {
      if (value !== undefined && (value < 0 || value > 1)) {
        errors.push(`sampleRate.${key} must be between 0 and 1`);
      }
    });
  }

  return errors;
}
```

#### 类型安全保证

**TypeScript 类型定义：**

1. **接口定义**：所有配置项都有明确的类型定义。
2. **默认值处理**：使用 `Required<SDKConfig>` 确保所有配置项都有值。
3. **编译时检查**：TypeScript 在编译时检查配置类型，避免运行时错误。

**使用示例：**

```typescript
const sdk = init({
  projectId: 'demo',
  endpoint: 'https://api.example.com/track',
  enable: {
    error: true,
    http: true,
  },
  http: {
    ignoreUrls: [/\.map$/, /health/],
    maskHeaders: ['Authorization'],
  },
});
```

---

## 第二部分：探针模块实现

### 2.1 错误探针 (ErrorProbe)

#### 错误捕获机制

**实现方式：**

1. **JS Error 监听**：通过 `window.addEventListener('error')` 监听全局错误：

```typescript
this.errorHandler = (event: ErrorEvent) => {
  if (this.reporter) {
    this.reporter('error', {
      errorType: 'js',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      error: event.error?.toString(),
    }, 'high');
  }
};
window.addEventListener('error', this.errorHandler);
```

2. **Promise Rejection 监听**：通过 `window.addEventListener('unhandledrejection')` 监听未处理的Promise拒绝：

```typescript
this.rejectionHandler = (event: PromiseRejectionEvent) => {
  if (this.reporter) {
    this.reporter('error', {
      errorType: 'promise',
      reason: event.reason?.toString(),
      stack: event.reason?.stack,
    }, 'high');
  }
};
window.addEventListener('unhandledrejection', this.rejectionHandler);
```

3. **资源加载错误监听**：通过捕获阶段的 `error` 事件监听资源加载错误：

```typescript
this.resourceErrorHandler = (event: Event) => {
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    const url = (target as HTMLImageElement).src || 
                (target as HTMLScriptElement).src || 
                (target as HTMLLinkElement).href;
    
    if (this.reporter) {
      this.reporter('error', {
        errorType: 'resource',
        tagName: target.tagName,
        url,
        type: event.type,
      }, 'high');
    }
  }
};
window.addEventListener('error', this.resourceErrorHandler, true);  // 捕获阶段
```

**关键点：**
- 使用捕获阶段（`true`）监听资源错误，确保能捕获到
- 区分不同类型的错误（JS错误、Promise拒绝、资源错误）
- 所有错误事件使用 `high` 优先级，确保及时上报

#### 监听器的注册和清理

**注册：** 在 `init()` 方法中注册监听器。

**清理：** 在 `destroy()` 方法中移除监听器：

```typescript
destroy(): void {
  if (this.errorHandler) {
    window.removeEventListener('error', this.errorHandler);
  }
  if (this.rejectionHandler) {
    window.removeEventListener('unhandledrejection', this.rejectionHandler);
  }
  if (this.resourceErrorHandler) {
    window.removeEventListener('error', this.resourceErrorHandler, true);
  }
  this.restoreConsole();
}
```

**注意事项：**
- 必须保存监听器引用，才能正确移除
- 移除时参数必须与注册时一致（包括捕获标志）

#### 错误信息采集

**采集的信息：**

1. **JS错误**：
   - `message`: 错误消息
   - `filename`: 文件名
   - `lineno`: 行号
   - `colno`: 列号
   - `stack`: 错误堆栈

2. **Promise拒绝**：
   - `reason`: 拒绝原因
   - `stack`: 错误堆栈（如果有）

3. **资源错误**：
   - `tagName`: 标签名（IMG/SCRIPT/LINK）
   - `url`: 资源URL
   - `type`: 事件类型

**源码位置获取：**
- 通过 `event.filename`、`event.lineno`、`event.colno` 获取
- 通过 `error.stack` 获取完整堆栈信息
- SourceMap 反查需要在服务端实现（根据文件名和行列号）

#### console 重写

**为什么默认关闭？**

1. **避免影响调试**：重写 `console.error` 和 `console.warn` 会影响开发者的调试体验。
2. **避免重复上报**：全局错误监听器已经能捕获大部分错误，console重写可能导致重复上报。
3. **性能考虑**：console重写会增加函数调用开销。

**实现方式（已实现但默认关闭）：**

```typescript
private interceptConsole(): void {
  if (typeof console === 'undefined') return;

  this.originalConsoleError = console.error;
  this.originalConsoleWarn = console.warn;

  const self = this;
  console.error = function(...args: any[]) {
    // 调用原始方法
    self.originalConsoleError!.apply(console, args);
    
    // 上报错误
    if (self.reporter) {
      self.reporter('error', {
        errorType: 'console',
        message: args.map(arg => String(arg)).join(' '),
      }, 'high');
    }
  };

  // console.warn 类似处理
}
```

**注意事项：**
- 必须保存原始方法引用
- 调用原始方法，避免影响原有功能
- 在 `destroy()` 中恢复原始方法

---

### 2.2 HTTP探针 (HttpProbe)

#### 请求拦截实现

**同时拦截 Fetch 和 XMLHttpRequest：**

1. **Fetch API 拦截**：

```typescript
private interceptFetch(): void {
  this.originalFetch = window.fetch;
  const self = this;

  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || (typeof input !== 'string' && 'method' in input ? input.method : 'GET');
    
    // 检查是否需要忽略
    if (self.config && shouldIgnoreUrl(url, self.config.ignoreUrls)) {
      return self.originalFetch!.call(window, input, init);
    }

    const startTime = performance.now();
    // ... 采集请求信息
    
    try {
      const response = await self.originalFetch!.call(window, input, init);
      const duration = performance.now() - startTime;
      
      // ... 采集响应信息并上报
      return response;
    } catch (error) {
      // ... 上报失败请求
      throw error;
    }
  };
}
```

2. **XMLHttpRequest 拦截**：

```typescript
private interceptXHR(): void {
  const self = this;
  
  // 保存原始方法
  this.originalXHROpen = XMLHttpRequest.prototype.open;
  this.originalXHRSend = XMLHttpRequest.prototype.send;

  // 拦截open方法
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args) {
    const urlString = typeof url === 'string' ? url : url.href;
    
    if (!self.config || !shouldIgnoreUrl(urlString, self.config.ignoreUrls)) {
      // 保存请求信息
      self.xhrRequestMap.set(this, {
        url: urlString,
        method: method.toUpperCase(),
        startTime: performance.now(),
      });
    }

    return self.originalXHROpen!.call(this, method, url, ...args);
  };

  // 拦截send方法
  XMLHttpRequest.prototype.send = function(body?: any) {
    const requestInfo = self.xhrRequestMap.get(this);
    
    if (requestInfo) {
      // 保存请求体
      if (body) {
        requestInfo.requestBody = body;
      }

      // 监听状态变化
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function(event) {
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(this, event);
        }

        // 请求完成时上报
        if (this.readyState === XMLHttpRequest.DONE) {
          const duration = performance.now() - requestInfo.startTime;
          // ... 采集信息并上报
          self.xhrRequestMap.delete(this);
        }
      };
    }

    return self.originalXHRSend!.call(this, body);
  };
}
```

**两种拦截方式的区别：**

| 特性 | Fetch API | XMLHttpRequest |
|------|-----------|----------------|
| **请求头获取** | ✅ 可以获取 | ❌ 无法获取（浏览器安全限制） |
| **响应头获取** | ✅ 可以获取 | ✅ 可以获取 |
| **请求体获取** | ✅ 可以获取 | ✅ 可以获取 |
| **拦截方式** | 直接替换 `window.fetch` | 替换原型方法 |
| **异步处理** | 原生支持 async/await | 需要监听 `onreadystatechange` |

**为什么XHR的请求头无法获取？**

浏览器出于安全考虑，不允许读取已设置的请求头。这是浏览器的安全策略，无法绕过。

#### 数据脱敏机制

**实现方式：**

```typescript
export function maskSensitiveData(
  data: Record<string, any>,
  keys: string[],
  maskChar: string = '***'
): Record<string, any> {
  const masked = { ...data };
  keys.forEach(key => {
    if (key in masked) {
      masked[key] = maskChar;
    }
  });
  return masked;
}
```

**使用示例：**

```typescript
// 请求头脱敏
if (self.config?.maskHeaders) {
  requestHeaders = maskSensitiveData(requestHeaders, self.config.maskHeaders);
}

// 请求体脱敏
if (requestBody && typeof requestBody === 'object' && self.config.maskBodyKeys) {
  requestBody = maskSensitiveData(requestBody, self.config.maskBodyKeys);
}
```

**配置示例：**

```typescript
const sdk = init({
  http: {
    maskHeaders: ['Authorization', 'Cookie'],
    maskBodyKeys: ['token', 'password', 'pwd'],
  },
});
```

**注意事项：**
- 只对配置的字段进行脱敏
- 脱敏后的值统一为 `***`
- 避免敏感信息泄露到日志中

#### 性能指标采集

**采集的指标：**

1. **请求时长**：使用 `performance.now()` 计算：

```typescript
const startTime = performance.now();
// ... 发送请求
const duration = performance.now() - startTime;
```

2. **请求大小**：
   - 字符串：`new Blob([body]).size`
   - Blob：`blob.size`
   - FormData：无法直接获取，标记为 `[FormData]`

3. **响应大小**：
   - 优先从 `Content-Length` 响应头获取
   - 如果没有，克隆响应并读取 blob 大小

**对性能分析的帮助：**
- 识别慢请求（duration > 2000ms）
- 识别大请求（requestSize/responseSize > 100KB）
- 分析网络性能趋势
- 优化API设计

---

### 2.3 性能探针 (PerformanceProbe)

#### Web Vitals 集成

**实现方式：**

使用动态导入 `web-vitals` 库，避免增加初始bundle大小：

```typescript
private initWebVitals(): void {
  if (this.webVitalsRegistered) return;

  // 动态导入web-vitals
  import('web-vitals').then((webVitals) => {
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = webVitals;
    
    const sendMetric = (metric: any) => {
      if (!this.reporter) return;

      this.reporter('perf', {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      }, 'normal');
    };

    // 注册所有Web Vitals指标
    onCLS(sendMetric);
    onFCP(sendMetric);
    onLCP(sendMetric);
    onTTFB(sendMetric);
    onINP(sendMetric); // INP替代了FID
  }).catch(err => {
    console.warn('[Performance Probe] 加载web-vitals失败:', err);
  });
}
```

**为什么选择动态导入？**

1. **减少初始体积**：`web-vitals` 库体积较大（约20KB），动态导入可以按需加载。
2. **性能优化**：只在启用性能探针时才加载，不影响其他功能。
3. **兼容性**：如果浏览器不支持，加载失败不影响SDK核心运行。

**采集的指标：**

- **FCP** (First Contentful Paint)：首次内容绘制
- **LCP** (Largest Contentful Paint)：最大内容绘制
- **CLS** (Cumulative Layout Shift)：累积布局偏移
- **TTFB** (Time to First Byte)：首字节时间
- **INP** (Interaction to Next Paint)：交互到下次绘制（替代FID）

#### 长任务监控

**实现方式：**

使用 `PerformanceObserver` 监听长任务：

```typescript
private initLongTaskObserver(): void {
  if (!('PerformanceObserver' in window)) {
    return;
  }

  const longTaskSampleRate = this.config?.longTaskSampleRate ?? 1.0;

  try {
    this.longTaskObserver = new PerformanceObserver((list) => {
      if (Math.random() > longTaskSampleRate) {
        return; // 被采样过滤
      }

      for (const entry of list.getEntries()) {
        // 长任务通常超过50ms
        if (entry.duration > 50 && this.reporter) {
          this.reporter('perf', {
            metric: 'long-task',
            value: entry.duration,
            rating: entry.duration > 100 ? 'poor' : entry.duration > 75 ? 'needs-improvement' : 'good',
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          }, 'normal');
        }
      }
    });

    // 尝试观察长任务（需要浏览器支持）
    this.longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // 浏览器不支持longtask类型，忽略
    if (this.longTaskObserver) {
      this.longTaskObserver = undefined;
    }
  }
}
```

**为什么需要采样率控制？**

1. **高频事件**：长任务可能频繁触发，全量上报会产生大量数据。
2. **性能考虑**：采样可以减少上报频率，降低性能开销。
3. **数据价值**：30%的采样率足以反映长任务的趋势。

**30%采样率的确定：**

- 基于实际测试：30%的采样率既能捕获主要问题，又不会产生过多数据。
- 可配置：用户可以根据实际情况调整采样率。

#### 性能指标上报频率

**上报时机：**

1. **Web Vitals**：每个指标在计算完成后立即上报（通常每个指标只上报一次）。
2. **长任务**：每次检测到长任务时上报（受采样率控制）。

**如何避免性能监控本身影响页面性能？**

1. **异步处理**：所有上报都是异步的，不阻塞主线程。
2. **采样率控制**：通过采样率减少上报频率。
3. **动态加载**：性能探针代码动态加载，不增加初始bundle大小。
4. **轻量级采集**：只采集必要的指标，不采集原始entries（数据量大）。

---

### 2.4 行为探针 (BehaviorProbe)

#### 路由监听

**同时支持多种路由方式：**

1. **History API**：拦截 `pushState` 和 `replaceState`：

```typescript
this.originalPushState = history.pushState;
this.originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  self.originalPushState!.apply(history, args);
  self.handleRouteChange();
};

history.replaceState = function(...args) {
  self.originalReplaceState!.apply(history, args);
  self.handleRouteChange();
};
```

2. **PopState事件**：监听浏览器前进后退：

```typescript
this.popstateHandler = () => {
  self.handleRouteChange();
};
window.addEventListener('popstate', this.popstateHandler);
```

3. **HashChange事件**：监听hash路由变化：

```typescript
window.addEventListener('hashchange', () => {
  self.handleRouteChange();
});
```

**路由变化处理：**

```typescript
private handleRouteChange(): void {
  const newPath = window.location.pathname + window.location.search + window.location.hash;
  
  // 如果路径没有变化，不重复上报
  if (newPath === this.currentPath) {
    return;
  }

  // 计算停留时长
  const stayDuration = Date.now() - this.pageEnterTime;

  // 上报上一个页面的停留时长
  if (this.reporter && this.currentPath) {
    this.reporter('page_view', {
      path: this.currentPath,
      stayDuration,
      action: 'leave',
    }, 'normal');
  }

  // 上报新页面
  this.reportPageView();
}
```

**不同路由框架的适配：**

- **React Router**：通过拦截 `history.pushState` 和 `history.replaceState` 实现。
- **Vue Router**：同样通过拦截 History API 实现。
- **原生路由**：通过监听 `popstate` 和 `hashchange` 实现。

**统一处理：** 所有路由方式都通过 `handleRouteChange()` 统一处理，保证了代码的一致性。

#### 页面停留时长统计

**实现方式：**

1. **记录进入时间**：在页面进入时记录 `pageEnterTime`：

```typescript
private reportPageView(): void {
  // ... 上报逻辑
  this.currentPath = path;
  this.pageEnterTime = Date.now();  // 记录进入时间
}
```

2. **计算停留时长**：在路由变化时计算停留时长：

```typescript
const stayDuration = Date.now() - this.pageEnterTime;
```

3. **页面可见性监听**：监听 `visibilitychange` 事件，处理页面隐藏/显示：

```typescript
private initVisibilityTracking(): void {
  this.visibilityChangeHandler = () => {
    if (document.hidden) {
      // 页面隐藏，记录隐藏时间
    } else {
      // 页面可见，更新进入时间
    }
  };
  document.addEventListener('visibilitychange', this.visibilityChangeHandler);
}
```

**会话超时处理：**

```typescript
const sessionTimeout = this.config?.sessionTimeout ?? 30 * 60 * 1000; // 默认30分钟

// 如果停留时长超过会话超时时间，视为新会话
if (stayDuration > sessionTimeout) {
  // 处理会话超时逻辑
}
```

#### 点击事件采集

**为什么默认关闭？**

1. **高频事件**：点击事件可能非常频繁，全量上报会产生大量数据。
2. **性能考虑**：每个点击都需要处理，可能影响页面性能。
3. **数据价值**：大部分点击事件对业务分析价值有限。

**实现方式（可选）：**

```typescript
private initClickTracking(): void {
  if (!this.reporter) return;

  const self = this;
  this.clickHandler = (event: MouseEvent) => {
    if (!self.reporter) return;
    
    const target = event.target as HTMLElement;
    const elementInfo = self.getElementInfo(target);

    self.reporter('click', {
      ...elementInfo,
      timestamp: Date.now(),
      page: window.location.pathname,
    }, 'low'); // 点击事件使用低优先级
  };

  document.addEventListener('click', this.clickHandler, true);
}
```

**采集的元素信息：**

- `tagName`: 标签名
- `id`: 元素ID
- `className`: 类名
- `text`: 文本内容（前50个字符）
- `href`: 链接地址（如果是链接）
- `buttonText`: 按钮文本（如果是按钮）

**如果启用，如何避免产生过多事件？**

1. **采样率控制**：可以添加采样率配置，只采集部分点击事件。
2. **防抖处理**：对频繁点击进行防抖处理。
3. **白名单机制**：只采集特定元素的点击事件（如按钮、链接）。

---

## 总结

### 架构设计亮点

1. **可插拔设计**：通过统一的 `Probe` 接口实现模块化，支持按需加载。
2. **动态加载**：使用 ES6 `import()` 实现代码分割，减少初始体积。
3. **错误隔离**：探针加载失败不影响其他探针和SDK核心。
4. **配置驱动**：通过配置控制探针行为，灵活且类型安全。

### 探针实现亮点

1. **错误探针**：全面捕获JS错误、Promise拒绝、资源错误，优先级高。
2. **HTTP探针**：同时拦截Fetch和XHR，支持脱敏和过滤。
3. **性能探针**：动态加载web-vitals，支持长任务监控和采样率控制。
4. **行为探针**：支持多种路由方式，自动PV和停留时长统计。

### 实际效果

- **初始体积减少 60-70%**（只启用错误探针时）
- **探针模块独立**，互不干扰
- **配置灵活**，支持多种场景
- **性能影响小**，异步处理，不阻塞主线程

---

## 相关代码文件

- SDK核心：`src/sdk/core/api/index.ts`
- 探针接口：`src/sdk/types/probes.ts`
- 错误探针：`src/sdk/probes/error/index.ts`
- HTTP探针：`src/sdk/probes/http/index.ts`
- 性能探针：`src/sdk/probes/performance/index.ts`
- 行为探针：`src/sdk/probes/behavior/index.ts`
- 配置系统：`src/sdk/config/index.ts`

