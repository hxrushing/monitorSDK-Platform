## 可插拔探针 SDK 方案（面向跨项目接入）

### 目标
- 在`sdk-platform`中沉淀一套轻量、可插拔的前端监控/埋点 SDK，可直接 npm/CDN 双形态供其他项目接入。
- 复用现有批量上报、自适应批量、离线缓存、Beacon、白屏检测能力，最小侵入集成到任意前端项目（React/Vue/原生）。

### 总体设计
- **产物形态**：UMD + ESM + IIFE（附.d.ts）；npm 发布 + CDN 分发。
- **核心结构**：
  - `core/transport`：批量队列、指数退避、Beacon、离线缓存、压缩。
  - `core/api`：`init / track / trackError / trackPage / trackHttp / trackPerf / flush`。
  - `probes/*`：按需注册的探针模块（错误、HTTP、性能、行为、白屏、资源）。
  - `adapters/*`：框架/路由适配层（history、react-router、vue-router、hash/pushstate）。
  - `config`：可配置开关、采样率、忽略规则、脱敏规则。
- **上报协议**：统一事件格式 `{ projectId, eventType, payload, ts, device, sdkVersion }`；单一 `/track` 接口批量接收。

### 模块能力
- **错误类**：JS Error、Promise rejection、资源加载错误、console 重写、源码位置采集（可加 SourceMap 反查钩子）。
- **HTTP 探针**：XHR/Fetch 拦截，采集 URL、method、status、duration、body/resp 体积，可配置白名单/忽略与脱敏字段。
- **性能探针**：FCP/LCP/CLS/TTFB/TTI、长任务、资源 timing，PerformanceObserver 采集，可配置采样率。
- **行为与会话**：自动 PV/路由切换、停留时长、点击/曝光（可选）、自定义事件 track。
- **白屏检测**：可配置 rootSelector/阈值/检查元素，复用现有实现。
- **可靠性**：自适应批量、指数退避、离线缓存、Beacon 收尾；弱网/断网下不丢数。

### 接入方式
- **npm**：
  ```ts
  import { init, track } from '@your/analytics';
  const sdk = init({ projectId: 'pid', endpoint: 'https://api.xxx/track' });
  sdk.track('customEvent', { foo: 1 });
  ```
- **CDN**：
  ```html
  <script src="https://cdn.xxx/sdk.iife.js"></script>
  <script>window.Analytics.init({ projectId: 'pid', endpoint: 'https://api.xxx/track' })</script>
  ```
- **框架适配**：提供 React/Vue/原生示例；路由监听通过 history/vite-router/vue-router 或 hash/popstate 兼容。

### 配置示例（草案）
```ts
init({
  projectId: 'pid',
  endpoint: 'https://api.xxx/track',
  enable: {
    error: true,
    http: true,
    perf: true,
    behavior: true,
    blankScreen: true,
  },
  sampleRate: {
    perf: 0.5,
    longTask: 0.3,
  },
  http: {
    ignoreUrls: [/\.map$/, /health/],
    maskHeaders: ['Authorization', 'Cookie'],
    maskBodyKeys: ['token', 'pwd'],
  },
  behavior: { autoPV: true, autoRoute: true },
  blankScreen: { rootSelector: '#root', threshold: 5000 },
});
```

### 兼容与安全
- 避免全局原型污染，拦截器可关闭/白名单；不阻断宿主请求。
- 体积控制：核心常驻，录屏/复杂性能指标可拆为可选子包按需动态加载。
- 隐私防护：字段脱敏、URL 白名单、最大 payload 限制、采样率与过滤规则。

### 最小后端闭环
- 保持单一 `/track` 批量写入；先落日志/单表（MySQL/ClickHouse/文件均可），后续再接聚合与看板。

### 落地步骤（建议迭代）
1) **SDK 抽象**：拆分 core/probes/adapters，整理公共事件格式与配置。
2) **构建输出**：新增打包配置（tsup/rollup）产出 UMD/ESM/IIFE+声明。
3) **探针对齐**：移植/精简 webfunny 关键探针（错误、HTTP、性能、白屏），接入批量传输。
4) **适配与示例**：提供 React/Vue/原生接入样例与快速开始文档。
5) **验证**：弱网/离线/Beacon/大批量压测，确认体积与性能开销。
6) **发布与接入**：npm 发包 + CDN 发布，提供版本号与变更日志。

### 后续可选增强
- 录屏/回放、Session 关联、指标告警（阈值+Webhook）、可视化看板对接。


