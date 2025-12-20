## AI 总结进度条功能实现说明

### 1. 功能概述

AI 总结功能在执行过程中会经历多个阶段（准备、收集项目数据、调用 AI 生成总结、准备邮件、发送邮件等），整体耗时相对较长。  
为减少用户等待焦虑，本项目在控制台中实现了一套**实时进度展示**能力，主要体现在：

- **可视化进度条**：以 0–100% 的进度条形式展示当前整体进度；
- **阶段状态展示**：展示当前处于“准备中 / 收集数据 / 生成总结 / 发送邮件 / 已完成 / 失败”等阶段；
- **步骤说明与项目进度**：展示更细粒度的文字说明和项目处理进度；
- **错误与完成提示**：在失败和完成时给出明确反馈。

该功能前端入口主要在 `AISummarySettings` 页面，后端逻辑在 `SummaryService` 中，并通过专门的 API 和 SSE 流向前端推送进度。

---

### 2. 整体架构 & 技术选型

- **后端**
  - 使用内存 `Map<string, SummaryTaskProgress>` 存储任务进度（生产环境建议替换为 Redis）；
  - 在 `SummaryService.generateAndSendSummary` 中按阶段更新进度；
  - 提供启动任务接口 + 进度查询接口 + SSE 进度推送接口。

- **前端**
  - 页面：`src/pages/AISummarySettings/index.tsx`；
  - 使用 React `useState` + `useRef` 管理进度与 SSE 连接状态；
  - UI 使用 Ant Design 的 `Progress`、`Card`、`Alert`、`Typography` 等组件渲染可视化进度。

- **通信方式**
  - **首选：Server-Sent Events (SSE)** 实时推送进度；
  - **降级：RESTful API 轮询**，在 SSE 不可用或失败时自动切换。

选择 SSE 的原因：

1. **实时性好**：进度更新后可以立即推送到前端，无需轮询等待；
2. **服务端推送**：由服务端主动推更新，减少前端无意义请求；
3. **实现简单**：只需单向通道，比 WebSocket 更轻量；
4. **浏览器原生支持自动重连**；
5. **方便提供轮询降级方案**，保证各种环境的兼容性。

---

### 3. 后端实现细节概览（SummaryService）

> 详细的服务端实现可以参考 `server/doc/前端进度显示功能实现说明.md`，这里只做与前端进度条强相关的梳理。

#### 3.1 任务进度数据结构

任务进度统一使用 `SummaryTaskProgress` 结构进行描述，核心字段包括：

- **taskId**：任务 ID，启动任务时生成并返回给前端；
- **userId**：所属用户 ID，用于权限校验；
- **status**：任务状态：
  - `pending` | `collecting` | `generating` | `sending` | `completed` | `failed`
- **progress**：整体进度百分比，区间为 0–100；
- **currentStep**：当前所处步骤的人类可读描述，如“正在使用 AI 生成总结…”；
- **totalProjects / processedProjects**：需要处理的项目总数与已处理数量；
- **error**：失败时的错误信息；
- **startedAt / updatedAt**：任务开始与最近更新时间。

这些字段会被直接透传到前端，用于驱动进度条和文字展示。

#### 3.2 进度分段设计

在 `SummaryService.generateAndSendSummary` 中，对整个流程进行了“分段占比”设计，大致如下（具体百分比以实现为准）：

1. **准备阶段**（约 0–5%）：初始化任务、校验配置；
2. **获取邮箱 / 项目列表**（约 5–15%）；
3. **收集项目数据**（核心耗时部分，约 15–65%）：
   - 每个项目占用约 `50% / 项目总数` 的进度；
4. **调用 AI 生成总结**（约 65–85%）：
   - 使用定时器 `setInterval` 做线性时间推进，避免长时间“卡住不动”；
5. **准备邮件 & 渲染 HTML**（约 85–90%）；
6. **发送邮件**（约 90–100%）。

各阶段通过 `updateProgress()` 统一写入 `taskProgress` Map 中，前端拿到的 `progress` 就是这套分段规则的结果。

#### 3.3 SSE & 轮询 API

- **启动任务**
  - `POST /api/ai-summary/send-now`
  - 返回：`{ success: true, taskId: 'uuid-string', message: '总结生成任务已启动，请查询进度' }`
  - 特点：**不阻塞等待任务完成**，而是立即返回 `taskId`。

- **SSE 进度流（推荐）**
  - `GET /api/ai-summary/progress/:taskId/stream?token=xxx`
  - 响应头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`
  - 服务端会持续推送如下格式的数据：
    - 常规进度：`data: {"success":true,"data":{"taskId":"...","status":"generating",...}}`
    - 心跳：`:` 开头的注释行，保证连接存活；
    - 完成/失败时：`event: close` 并附带最终进度数据，然后关闭连接。

- **轮询查询（降级方案）**
  - `GET /api/ai-summary/progress/:taskId`
  - 返回上述 `SummaryTaskProgress` 的最新快照；
  - 用于 SSE 不可用或断开时的兼容方案。

---

### 4. 前端实现细节（AISummarySettings 页面）

前端主要逻辑在 `src/pages/AISummarySettings/index.tsx` 中完成，该页面除了负责 AI 总结的定时/邮箱配置之外，也承担了“手动立即发送 + 进度展示”的职责。

#### 4.1 前端进度状态结构

页面内部定义了与后端进度结构对应的接口：

```ts
interface SummaryProgress {
  taskId: string;
  userId: string;
  status: 'pending' | 'collecting' | 'generating' | 'sending' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  totalProjects: number;
  processedProjects: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}
```

核心状态：

- `const [progress, setProgress] = useState<SummaryProgress | null>(null);`
- `const eventSourceRef = useRef<EventSource | null>(null);`

其中：

- `progress`：驱动进度条和各种文字描述；
- `eventSourceRef`：记录当前的 SSE 连接，方便在重新发送 / 组件卸载时关闭。

#### 4.2 启动任务与建立 SSE 连接

在“立即发送”按钮点击时：

1. 调用 `apiService.sendAISummaryNow()`，后端返回 `taskId`；
2. 如果返回成功且包含 `taskId`：
   - 调用 `connectProgressStream(taskId)` 建立 SSE 连接；
   - 设置本地 `sending` 状态，并弹出“任务已启动”的提示。

`connectProgressStream(taskId)` 内部逻辑大致如下：

- **关闭旧连接**：如果 `eventSourceRef.current` 存在，则先 `close()` 掉；
- **构造带 token 的 SSE URL**；
- **创建 EventSource 实例**；
- **绑定事件回调**：
  - `onopen`：打印连接建立日志；
  - `onmessage`：
    - 将 `event.data` 反序列化；
    - 如果 `data.success && data.data`，调用 `setProgress(data.data)`；
    - 当状态为 `completed` 或 `failed` 时：
      - 关闭连接、置空 `eventSourceRef`、`setSending(false)`；
      - 根据结果弹出成功/失败提示；
  - 自定义 `error` 事件（`addEventListener('error', ...)`）：
    - 如果服务端返回了错误信息，展示对应 message；
    - 关闭连接并重置发送状态；
    - 后续可按需要接入降级逻辑（参见 server 端文档中的 `fallbackToPolling` 示例）。

#### 4.3 轮询降级逻辑（fallback 示例）

当浏览器不支持 SSE、网络环境拦截了事件流，或连接出错时，可退回到轮询模式：

```ts
const fallbackToPolling = (taskId: string) => {
  const timer = setInterval(async () => {
    const result = await apiService.getSummaryProgress(taskId);
    if (result?.success && result.data) {
      setProgress(result.data);
      if (result.data.status === 'completed' || result.data.status === 'failed') {
        clearInterval(timer);
      }
    }
  }, 2000);
};
```

项目中已经预留了对应的 API 方法 `apiService.getSummaryProgress(taskId)`，可根据需要在 SSE `onerror` 或自定义事件中触发。

#### 4.4 进度条 UI 展示

当 `progress` 有值时，页面会渲染一个“生成进度”的卡片区域：

- **顶部状态图标**
  - `completed`：绿色 `CheckCircleOutlined`；
  - `failed`：红色“失败”标签；
  - 处理中：`Spin` 旋转小菊花。

- **核心进度条**
  - 使用 Antd 的 `Progress` 组件；
  - `percent`：直接使用 `progress.progress`；
  - `status`：
    - `failed` → `exception`；
    - `completed` → `success`；
    - 其它进行中状态 → `active`；
  - `strokeColor`：
    - 进行中：蓝色 `#1890ff`；
    - 成功：绿色 `#52c41a`；
    - 失败：红色 `#ff4d4f`。

- **文字状态说明**
  - “当前状态”：将枚举状态映射为中文文案：
    - `pending` → 准备中
    - `collecting` → 收集数据
    - `generating` → 生成总结
    - `sending` → 发送邮件
    - `completed` → 已完成
    - `failed` → 失败
  - “当前步骤”：直接展示 `progress.currentStep`；
  - “项目进度”：在 `totalProjects > 0` 时显示 `processedProjects / totalProjects`；
  - 错误信息：如果 `progress.error` 存在，则用 `Alert` 展示；
  - 完成提示：在 `status === 'completed'` 时展示“总结已成功发送”的成功 `Alert`。

---

### 5. 用户体验与性能考虑

#### 5.1 用户体验

- 用户可以在“AI 总结设置”页面点击“立即发送”后，实时观察：
  - 当前整体进度百分比；
  - 当前处于哪个阶段；
  - 当前具体执行的步骤说明；
  - 多项目场景下的项目处理进度；
  - 失败时的详细错误原因。
- 整个过程颜色与图标明确区分“进行中 / 成功 / 失败”，减少等待焦虑。

#### 5.2 性能与资源管理

- **后端**
  - 任务进度存储在内存中，并有过期清理（如清理 1 小时前的任务）；
  - 建议在生产环境中使用 Redis 存储，以支持多实例和更大规模。

- **SSE 连接**
  - 每个任务对应一个 SSE 连接，任务完成或失败后主动关闭；
  - 组件卸载时需要关闭连接，避免资源泄漏；
  - 服务端通过心跳保持连接活跃，并在异常时返回错误事件，便于前端降级。

- **轮询降级**
  - 轮询频率建议控制在 2 秒级别；
  - 任务完成或失败时及时清理定时器。

---

### 6. 后续可扩展方向

1. **进度持久化与历史查询**
   - 将任务进度和结果持久化（数据库 / Redis），提供历史记录列表与详情页；
   - 支持在控制台查看历史总结结果、重新发送邮件等能力。

2. **更细粒度的阶段划分**
   - 对“收集数据”“生成总结”等阶段进一步拆分子步骤（例如按数据源、按模型调用阶段等）；
   - 在 UI 上增加更详细的阶段提示或时间预估。

3. **WebSocket 扩展（可选）**
   - 对于需要双向通信的高级用例，可以扩展为 WebSocket；
   - 当前 SSE 已足够覆盖“实时进度展示”场景，一般不必强制升级。

4. **多任务并发进度展示**
   - 目前页面只展示当前发送任务的进度；
   - 后续可以考虑支持一个列表视图，展示多个历史任务的状态和进度。

---

### 7. 快速查阅：相关代码入口

- **前端**
  - 页面与 UI 入口：`src/pages/AISummarySettings/index.tsx`
  - API 封装：`src/services/api.ts` 中的 `sendAISummaryNow` 与 `getSummaryProgress`

- **后端**
  - 任务进度与业务流程：`server/src/services/summaryService.ts`
  - API 路由：`server/src/routes/api.ts` 中 `/ai-summary/send-now`、`/ai-summary/progress/:taskId`、`/ai-summary/progress/:taskId/stream`
  - 设计说明文档：`server/doc/前端进度显示功能实现说明.md`

通过以上代码与文档，即可快速理解并扩展当前 AI 总结进度条功能。


