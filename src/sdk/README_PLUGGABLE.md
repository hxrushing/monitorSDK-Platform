# 可插拔探针SDK方案实现说明

## 当前实现状态

### ✅ 阶段1（P0）核心能力 - 已完成

1. **SDK核心抽象**
   - ✅ `core/transport`: 传输管道实现（批量队列、指数退避、Beacon、离线缓存）
   - ✅ `core/api`: API层实现（init/track/trackError/trackPage/trackHttp/trackPerf/flush）
   - ✅ `config`: 配置系统（enable开关、采样率、忽略规则、脱敏规则）
   - ✅ 统一事件格式定义

2. **传输管道**
   - ✅ 批量队列管理
   - ✅ 指数退避重试机制
   - ✅ Beacon API支持
   - ✅ 离线缓存
   - ⚠️ 压缩策略（基础骨架已实现，完整功能待完善）

3. **API接口**
   - ✅ init
   - ✅ track
   - ✅ trackError
   - ✅ trackPage
   - ✅ trackHttp
   - ✅ trackPerf
   - ✅ flush
   - ✅ setUser

4. **构建输出**
   - ✅ UMD/ESM/IIFE格式
   - ✅ TypeScript声明文件(.d.ts)
   - ✅ npm/CDN双形态支持

### 🚧 阶段2（P1）关键探针与适配 - 进行中

1. **错误探针** - ✅ 基础实现完成
   - ✅ JS Error监听
   - ✅ Promise rejection监听
   - ✅ 资源加载错误监听
   - ⚠️ console重写（已实现但默认关闭，避免影响调试）

2. **HTTP探针** - ⏳ 待实现
   - ⏳ XHR/Fetch拦截
   - ⏳ 白名单/忽略配置
   - ⏳ 脱敏配置

3. **性能探针** - ⏳ 待实现
   - ⏳ FCP/LCP/CLS/TTFB/长任务采集
   - ⏳ PerformanceObserver集成
   - ⏳ 采样率控制

4. **行为探针** - ⏳ 待实现
   - ⏳ 自动PV上报
   - ⏳ 路由切换监听

5. **路由适配器** - ⏳ 待实现
   - ⏳ history适配
   - ⏳ react-router适配
   - ⏳ vue-router适配
   - ⏳ hash/pushstate适配

## 使用方法

### npm方式

```typescript
import { init } from '@your/analytics-sdk';

const sdk = init({
  projectId: 'your-project-id',
  endpoint: 'https://api.example.com/track',
  enable: {
    error: true,
    http: true,
    perf: true,
    behavior: true,
    blankScreen: true,
  },
  sampleRate: {
    perf: 0.5,
    http: 1.0,
    error: 1.0,
  },
  http: {
    ignoreUrls: [/\.map$/, /health/],
    maskHeaders: ['Authorization', 'Cookie'],
    maskBodyKeys: ['token', 'password'],
  },
  behavior: {
    autoPV: true,
    autoRoute: true,
  },
  blankScreen: {
    enabled: true,
    rootSelector: '#root',
    threshold: 5000,
  },
});

// 使用
sdk.track('customEvent', { foo: 1 });
sdk.trackError('api_error', { message: 'API failed' });
sdk.trackPage('/home');
sdk.flush();
```

### CDN方式

```html
<script src="https://cdn.example.com/sdk/index.global.js"></script>
<script>
  const sdk = window.Analytics.init({
    projectId: 'your-project-id',
    endpoint: 'https://api.example.com/track',
  });
  
  sdk.track('page_view', { path: window.location.pathname });
</script>
```

## 目录结构

```
src/sdk/
├── core/                    # 核心模块
│   ├── api/                # API层
│   │   └── index.ts
│   ├── transport/          # 传输管道
│   │   └── index.ts
│   └── types.ts            # 核心类型定义
├── config/                  # 配置系统
│   └── index.ts
├── types/                   # 类型定义
│   ├── transport.ts        # 传输层类型
│   └── probes.ts           # 探针类型
├── probes/                  # 探针模块
│   └── error/              # 错误探针
│       └── index.ts
├── adapters/               # 路由适配器（待实现）
│   ├── history.ts
│   ├── react-router.ts
│   └── vue-router.ts
├── index.ts                # 主入口
└── README.md
```

## 下一步计划

### 立即需要实现（P1优先级）

1. **HTTP探针**
   - 拦截XHR和Fetch
   - 实现URL过滤和脱敏

2. **性能探针**
   - 集成web-vitals
   - PerformanceObserver采集

3. **行为探针**
   - 自动PV上报
   - 路由切换监听

4. **路由适配器**
   - 提供React/Vue/原生路由适配

5. **示例代码**
   - React示例
   - Vue示例
   - 原生JavaScript示例

### 后续优化（P2/P3）

- 白屏检测完善
- 压缩算法完善
- 自适应批量优化
- 录屏/回放功能
- 可视化看板对接

## 注意事项

1. **构建警告**: uuid库依赖Node.js的crypto模块，在浏览器环境中会有警告，但不影响功能。未来可以考虑使用浏览器原生crypto API替代。

2. **探针注册**: 目前探针需要手动注册，后续可以在SDK初始化时自动加载已启用的探针。

3. **配置验证**: 配置验证功能已实现，会在初始化时检查配置有效性。

4. **向后兼容**: 新的SDK结构与旧的实现并存，可以逐步迁移。

