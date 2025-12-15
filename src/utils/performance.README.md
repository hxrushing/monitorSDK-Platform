# Web Vitals 性能监控

## 📊 功能说明

本模块实现了基于 Google Web Vitals 的性能监控功能，自动收集并上报以下性能指标：

- **FCP (First Contentful Paint)**: 首次内容绘制时间
- **LCP (Largest Contentful Paint)**: 最大内容绘制时间
- **CLS (Cumulative Layout Shift)**: 累积布局偏移
- **TTFB (Time to First Byte)**: 首字节时间
- **INP (Interaction to Next Paint)**: 交互到下次绘制时间（替代了 FID）

**注意**: FID (First Input Delay) 在 web-vitals v5 中已被 INP (Interaction to Next Paint) 替代，INP 提供了更全面的交互性能测量。

## 🚀 使用方法

### 1. 自动初始化

性能监控已在 `src/main.tsx` 中自动初始化，无需手动调用。

### 2. 数据上报

性能数据会通过项目的埋点 SDK 自动上报，事件名称为 `web_vitals`。

### 3. 开发环境调试

在开发环境下，性能指标会输出到浏览器控制台，格式如下：

```
[Performance] ✅ LCP: 1234.56 (good)
[Performance] ⚠️ FCP: 2345.67 (needs-improvement)
[Performance] ❌ CLS: 0.15 (poor)
```

## 📈 性能阈值

| 指标 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| 指标 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| FCP  | ≤ 1.8s | 1.8s - 3.0s | > 3.0s |
| LCP  | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| CLS  | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |
| TTFB | ≤ 800ms | 800ms - 1.8s | > 1.8s |
| INP  | ≤ 200ms | 200ms - 500ms | > 500ms |

**注意**: FID (First Input Delay) 在 web-vitals v5 中已被 INP (Interaction to Next Paint) 替代，INP 提供了更全面的交互性能测量。

## 🔧 API 说明

### `initPerformanceMonitoring(projectId?: string)`

初始化性能监控。

**参数：**
- `projectId` (可选): 项目ID，如果不提供则从 localStorage 读取

**示例：**
```typescript
import { initPerformanceMonitoring } from '@/utils/performance';

initPerformanceMonitoring('my-project-id');
```

### `reportWebVitals(onPerfEntry?: ReportHandler)`

注册 Web Vitals 性能监控回调。

**参数：**
- `onPerfEntry` (可选): 自定义性能指标处理函数

**示例：**
```typescript
import { reportWebVitals } from '@/utils/performance';

reportWebVitals((metric) => {
  console.log('性能指标:', metric);
});
```

### `formatMetric(metric: PerformanceMetric): string`

格式化性能指标为可读字符串。

**示例：**
```typescript
import { formatMetric } from '@/utils/performance';

const formatted = formatMetric(metric);
// 输出: "LCP: 1234.56ms (good)"
```

### `getMetricThresholds(name: string)`

获取性能指标的阈值信息。

**示例：**
```typescript
import { getMetricThresholds } from '@/utils/performance';

const thresholds = getMetricThresholds('LCP');
// 输出: { good: 2500, needsImprovement: 4000 }
```

## 📦 数据结构

性能数据通过 SDK 发送，包含以下字段：

```typescript
{
  指标名称: string,        // 'FCP' | 'LCP' | 'CLS' | 'TTFB' | 'INP'
  指标值: number,          // 指标的实际数值
  评级: string,            // 'good' | 'needs-improvement' | 'poor'
  变化量: number,          // 相对于上次的变化量
  指标ID: string,          // 唯一标识符
  页面URL: string,         // 当前页面完整URL
  页面路径: string,         // 当前页面路径
  时间戳: number,          // 时间戳
  用户代理: string,        // 浏览器 User Agent
  连接类型: string,        // 网络连接类型
  设备内存: string,        // 设备内存（如果支持）
  硬件并发: number,        // CPU 核心数
}
```

## 🔍 查看性能数据

性能数据会作为埋点事件存储在数据库中，可以通过以下方式查看：

1. **事件分析页面**: 筛选事件名称为 `web_vitals` 的事件
2. **数据库查询**: 查询 `events` 表中 `event_name = 'web_vitals'` 的记录

## ⚙️ 配置说明

性能监控会自动使用当前选中的项目ID。如果项目ID发生变化，性能数据会自动关联到新的项目。

项目ID的获取优先级：
1. 初始化时传入的 `projectId` 参数
2. `localStorage.getItem('selectedProjectId')`
3. 默认值 `'demo-project'`

## 🐛 故障排查

### 性能数据未上报

1. 检查 SDK 是否正常初始化
2. 检查项目ID是否正确设置
3. 查看浏览器控制台是否有错误信息
4. 确认网络请求是否成功发送

### 开发环境看不到日志

确保 `import.meta.env.DEV` 为 `true`，性能监控会在开发环境下输出详细日志。

## 📚 参考文档

- [Web Vitals](https://web.dev/vitals/)
- [web-vitals 库文档](https://github.com/GoogleChrome/web-vitals)

