# 可插拔SDK实现指南

## 📖 目录

1. [设计理念](#设计理念)
2. [核心架构](#核心架构)
3. [探针接口规范](#探针接口规范)
4. [如何实现一个新探针](#如何实现一个新探针)
5. [动态加载机制](#动态加载机制)
6. [配置系统](#配置系统)
7. [传输管道](#传输管道)
8. [完整示例](#完整示例)
9. [最佳实践](#最佳实践)

---

## 设计理念

可插拔SDK的核心思想是**按需加载、模块化设计、统一接口**。通过这种设计，我们可以：

- ✅ **减少初始体积**：只加载需要的探针模块
- ✅ **灵活扩展**：轻松添加新的监控能力
- ✅ **统一管理**：所有探针通过统一的接口和配置管理
- ✅ **易于维护**：每个探针独立实现，互不干扰

### 核心原则

1. **接口标准化**：所有探针实现统一的 `Probe` 接口
2. **动态加载**：探针按需动态导入，避免增加初始bundle大小
3. **事件驱动**：探针通过事件上报函数与SDK核心通信
4. **配置驱动**：通过配置控制探针的启用和参数

---

## 核心架构

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (Application)                   │
│  init({ enable: { error: true, http: true, ... } })     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  SDK核心层 (SDKCore)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  配置管理     │  │  探针管理     │  │  传输管道     │ │
│  │  Config      │  │  ProbeManager│  │  Transport   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼────┐ ┌─────▼─────┐ ┌───▼────────┐
│ 错误探针   │ │ HTTP探针   │ │ 性能探针   │
│ ErrorProbe│ │ HttpProbe │ │ PerfProbe  │
└───────────┘ └───────────┘ └────────────┘
```

### 目录结构

```
src/sdk/
├── core/                    # 核心模块
│   ├── api/                # API层（SDKCore类）
│   │   └── index.ts
│   ├── transport/          # 传输管道
│   │   └── index.ts
│   └── types.ts            # 核心类型定义
├── config/                  # 配置系统
│   └── index.ts
├── types/                   # 类型定义
│   ├── transport.ts        # 传输层类型
│   └── probes.ts           # 探针类型
├── probes/                  # 探针模块（可插拔）
│   ├── error/              # 错误探针
│   │   └── index.ts
│   ├── http/               # HTTP探针
│   │   └── index.ts
│   ├── performance/        # 性能探针
│   │   └── index.ts
│   └── behavior/           # 行为探针
│       └── index.ts
├── index.ts                # 主入口
└── README.md
```

---

## 探针接口规范

### Probe接口定义

所有探针必须实现 `Probe` 接口：

```typescript
/**
 * 探针接口
 * 所有探针模块必须实现此接口
 */
export interface Probe {
  /**
   * 探针名称（唯一标识）
   */
  name: string;

  /**
   * 是否启用
   */
  enabled: boolean;

  /**
   * 初始化探针
   * @param reporter 事件上报函数，探针通过此函数上报事件
   */
  init(reporter: EventReporter): void;

  /**
   * 销毁探针，清理资源
   */
  destroy(): void;
}
```

### EventReporter类型

探针通过 `EventReporter` 函数上报事件：

```typescript
/**
 * 事件上报回调函数类型
 * @param eventType 事件类型（如 'error', 'http', 'perf' 等）
 * @param payload 事件数据
 * @param priority 事件优先级（可选，默认 'normal'）
 */
export type EventReporter = (
  eventType: string,
  payload: Record<string, any>,
  priority?: 'high' | 'normal' | 'low'
) => void;
```

### 探针生命周期

```
1. 构造函数
   ↓
2. init(reporter) - 初始化，注册监听器
   ↓
3. 运行中 - 通过reporter上报事件
   ↓
4. destroy() - 清理资源，移除监听器
```

---

## 如何实现一个新探针

### 步骤1：创建探针文件

在 `src/sdk/probes/` 目录下创建新的探针目录和文件：

```typescript
// src/sdk/probes/custom/index.ts

import { Probe, EventReporter } from '../../types/probes';

export class CustomProbe implements Probe {
  public readonly name = 'custom';
  public enabled: boolean = true;

  private reporter?: EventReporter;
  private handler?: () => void;

  /**
   * 初始化探针
   */
  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    
    this.reporter = reporter;

    // 注册事件监听器
    this.handler = () => {
      if (this.reporter) {
        this.reporter('custom_event', {
          timestamp: Date.now(),
          // ... 其他数据
        }, 'normal');
      }
    };

    // 添加事件监听
    window.addEventListener('customEvent', this.handler);
  }

  /**
   * 销毁探针
   */
  destroy(): void {
    // 移除事件监听
    if (this.handler) {
      window.removeEventListener('customEvent', this.handler);
      this.handler = undefined;
    }

    // 清理引用
    this.reporter = undefined;
  }
}
```

### 步骤2：在SDK核心中注册探针

在 `src/sdk/core/api/index.ts` 的 `initProbes()` 方法中添加探针加载逻辑：

```typescript
// src/sdk/core/api/index.ts

private initProbes(): void {
  // ... 其他探针

  // 动态导入自定义探针
  if (this.config.enable.custom) {
    import('../../probes/custom').then(({ CustomProbe }) => {
      const probe = new CustomProbe();
      probe.init((eventType, payload, priority) => {
        // 根据事件类型调用相应的track方法
        if (eventType === 'custom_event') {
          this.track('custom_event', payload, priority);
        }
      });
      this.probes.set(probe.name, probe);
    }).catch(err => {
      console.warn('加载自定义探针失败:', err);
    });
  }
}
```

### 步骤3：添加配置类型

在 `src/sdk/config/index.ts` 中添加配置类型：

```typescript
// src/sdk/config/index.ts

export interface SDKConfig {
  // ... 其他配置
  enable: {
    // ... 其他探针
    custom?: boolean;  // 添加自定义探针开关
  };
  
  // 如果需要探针特定配置
  custom?: {
    // 自定义探针的配置项
    option1?: string;
    option2?: number;
  };
}
```

### 步骤4：导出探针

在 `src/sdk/index.ts` 中导出新探针：

```typescript
// src/sdk/index.ts

// 导出探针（用于测试和高级用法）
export { CustomProbe } from './probes/custom';
```

### 步骤5：使用探针

```typescript
import { init } from './sdk';

const sdk = init({
  projectId: 'demo',
  endpoint: 'https://api.example.com/track',
  enable: {
    custom: true,  // 启用自定义探针
  },
  custom: {
    option1: 'value1',
    option2: 100,
  },
});
```

---

## 动态加载机制

### 为什么使用动态加载？

1. **减少初始bundle大小**：只加载启用的探针
2. **按需加载**：根据配置动态导入
3. **代码分割**：每个探针可以独立打包

### 实现方式

使用 ES6 动态 `import()` 实现按需加载：

```typescript
// src/sdk/core/api/index.ts

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
        this.trackHttp({
          url: payload.url,
          method: payload.method,
          // ...
        });
      });
      this.probes.set(probe.name, probe);
    }).catch(err => {
      console.warn('加载HTTP探针失败:', err);
    });
  }
}
```

### 构建配置

确保构建工具（如 Vite、Webpack）支持代码分割：

```typescript
// vite.config.ts 或 webpack.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        // 确保探针模块可以独立打包
        manualChunks: {
          'probe-error': ['./src/sdk/probes/error'],
          'probe-http': ['./src/sdk/probes/http'],
          // ...
        }
      }
    }
  }
}
```

---

## 配置系统

### 配置结构

```typescript
interface SDKConfig {
  // 必需配置
  projectId: string;
  endpoint: string;

  // 探针开关
  enable: {
    error?: boolean;
    http?: boolean;
    perf?: boolean;
    behavior?: boolean;
    blankScreen?: boolean;
  };

  // 采样率配置
  sampleRate: {
    error?: number;      // 0-1之间
    http?: number;
    perf?: number;
    longTask?: number;
    behavior?: number;
  };

  // 探针特定配置
  http?: HttpProbeConfig;
  behavior?: BehaviorProbeConfig;
  blankScreen?: BlankScreenConfig;

  // 其他配置
  debug?: boolean;
  batch?: BatchConfig;
}
```

### 配置合并与验证

```typescript
// src/sdk/config/index.ts

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Required<SDKConfig> = {
  projectId: '',
  endpoint: '',
  enable: {
    error: false,
    http: false,
    perf: false,
    behavior: false,
    blankScreen: false,
  },
  sampleRate: {
    error: 1.0,
    http: 1.0,
    perf: 1.0,
    longTask: 0.3,
    behavior: 1.0,
  },
  // ...
};

/**
 * 合并配置
 */
export function mergeConfig(config: SDKConfig): Required<SDKConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    enable: { ...DEFAULT_CONFIG.enable, ...config.enable },
    sampleRate: { ...DEFAULT_CONFIG.sampleRate, ...config.sampleRate },
    // ...
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: SDKConfig): string[] {
  const errors: string[] = [];

  if (!config.projectId) {
    errors.push('projectId 是必需的');
  }

  if (!config.endpoint) {
    errors.push('endpoint 是必需的');
  }

  // 验证采样率范围
  Object.entries(config.sampleRate || {}).forEach(([key, value]) => {
    if (value !== undefined && (value < 0 || value > 1)) {
      errors.push(`${key} 采样率必须在 0-1 之间`);
    }
  });

  return errors;
}
```

---

## 传输管道

### Transport类职责

传输管道负责：
- 事件队列管理
- 批量上报
- 重试机制
- 离线缓存
- Beacon API支持

### 使用方式

探针不需要直接调用传输管道，而是通过SDK核心的track方法：

```typescript
// 探针中
this.reporter('error', {
  errorType: 'js',
  message: 'Something went wrong',
}, 'high');

// SDK核心中
public trackError(errorType: string, errorDetails: Record<string, any>): void {
  const event = this.createEvent('error', {
    errorType,
    ...errorDetails,
  });
  // 添加到传输管道
  this.transport.addEvent(event, 'high');
}
```

### 事件优先级

- `high`: 错误事件、关键性能指标
- `normal`: 普通事件、HTTP请求
- `low`: 行为事件、非关键数据

---

## 完整示例

### 示例1：实现一个资源加载探针

```typescript
// src/sdk/probes/resource/index.ts

import { Probe, EventReporter } from '../../types/probes';

export interface ResourceProbeConfig {
  trackImages?: boolean;
  trackScripts?: boolean;
  trackStyles?: boolean;
  trackFonts?: boolean;
}

export class ResourceProbe implements Probe {
  public readonly name = 'resource';
  public enabled: boolean = true;

  private reporter?: EventReporter;
  private config: ResourceProbeConfig;
  private observer?: PerformanceObserver;

  constructor(config: ResourceProbeConfig = {}) {
    this.config = {
      trackImages: true,
      trackScripts: true,
      trackStyles: true,
      trackFonts: false,
      ...config,
    };
  }

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 使用 PerformanceObserver 监听资源加载
    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.handleResourceEntry(resourceEntry);
            }
          });
        });

        this.observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('ResourceProbe: PerformanceObserver not supported', e);
      }
    }
  }

  private handleResourceEntry(entry: PerformanceResourceTiming): void {
    const initiatorType = entry.initiatorType;
    
    // 根据配置过滤资源类型
    if (
      (initiatorType === 'img' && !this.config.trackImages) ||
      (initiatorType === 'script' && !this.config.trackScripts) ||
      (initiatorType === 'link' && !this.config.trackStyles) ||
      (initiatorType === 'css' && !this.config.trackStyles) ||
      (initiatorType === 'font' && !this.config.trackFonts)
    ) {
      return;
    }

    if (this.reporter) {
      this.reporter('resource', {
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: entry.duration,
        size: entry.transferSize,
        startTime: entry.startTime,
        responseEnd: entry.responseEnd,
        // 判断是否加载失败
        failed: entry.transferSize === 0 && entry.duration > 0,
      }, 'low');
    }
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
    this.reporter = undefined;
  }
}
```

### 示例2：在SDK中注册资源探针

```typescript
// src/sdk/core/api/index.ts

private initProbes(): void {
  // ... 其他探针

  // 动态导入资源探针
  if (this.config.enable.resource) {
    import('../../probes/resource').then(({ ResourceProbe }) => {
      const probe = new ResourceProbe(this.config.resource);
      probe.init((_eventType, payload) => {
        this.track('resource', payload, 'low');
      });
      this.probes.set(probe.name, probe);
    }).catch(err => {
      console.warn('加载资源探针失败:', err);
    });
  }
}
```

### 示例3：使用资源探针

```typescript
import { init } from './sdk';

const sdk = init({
  projectId: 'demo',
  endpoint: 'https://api.example.com/track',
  enable: {
    resource: true,
  },
  resource: {
    trackImages: true,
    trackScripts: true,
    trackStyles: true,
    trackFonts: false,
  },
});
```

---

## 最佳实践

### 1. 探针设计原则

- ✅ **单一职责**：每个探针只负责一种类型的监控
- ✅ **独立运行**：探针之间不相互依赖
- ✅ **资源清理**：在 `destroy()` 中清理所有监听器和引用
- ✅ **错误处理**：探针内部错误不应影响SDK核心运行

### 2. 事件上报

```typescript
// ✅ 好的做法：提供完整的事件数据
this.reporter('error', {
  errorType: 'js',
  message: error.message,
  stack: error.stack,
  filename: error.filename,
  lineno: error.lineno,
  colno: error.colno,
}, 'high');

// ❌ 不好的做法：数据不完整
this.reporter('error', {
  message: 'Something went wrong',
});
```

### 3. 性能考虑

- **采样率**：对于高频事件，使用采样率控制
- **防抖节流**：对于可能频繁触发的事件，使用防抖或节流
- **延迟加载**：大型依赖使用动态导入

```typescript
// 示例：防抖处理
private debouncedReport = debounce((data: any) => {
  if (this.reporter) {
    this.reporter('click', data, 'normal');
  }
}, 100);

// 示例：采样率控制
if (Math.random() > this.sampleRate) {
  return; // 跳过本次上报
}
```

### 4. 错误处理

```typescript
init(reporter: EventReporter): void {
  try {
    // 探针初始化逻辑
    this.setupListeners();
  } catch (error) {
    // 记录错误但不抛出，避免影响SDK核心
    console.warn(`[${this.name}Probe] 初始化失败:`, error);
    this.enabled = false;
  }
}
```

### 5. 类型安全

```typescript
// ✅ 使用明确的类型定义
export interface CustomEventData {
  action: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

this.reporter('custom', {
  action: 'click',
  timestamp: Date.now(),
} as CustomEventData);
```

### 6. 测试友好

```typescript
// 提供测试钩子
export class CustomProbe implements Probe {
  // ... 其他代码

  // 测试时可以手动触发
  public triggerTestEvent(): void {
    if (this.reporter) {
      this.reporter('test', { test: true });
    }
  }
}
```

---

## 总结

实现可插拔SDK的关键点：

1. **统一接口**：所有探针实现 `Probe` 接口
2. **动态加载**：使用 `import()` 按需加载探针
3. **事件驱动**：通过 `EventReporter` 上报事件
4. **配置驱动**：通过配置控制探针行为
5. **资源清理**：在 `destroy()` 中清理所有资源

通过这种设计，我们可以轻松扩展SDK的功能，同时保持代码的模块化和可维护性。

---

## 相关文档

- [探针模块实现总结](./探针模块实现总结.md)
- [可插拔探针SDK方案](./可插拔探针SDK方案.md)
- [可插拔探针SDK方案实现优先级](./可插拔探针SDK方案实现优先级.md)

