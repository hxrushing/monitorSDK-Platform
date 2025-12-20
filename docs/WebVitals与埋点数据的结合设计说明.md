# Web Vitals 与埋点数据的结合设计说明

## 📋 概述

本文档说明 SDK 如何将 Web Vitals 性能指标与业务埋点数据统一采集并结合，探讨其实现机制、数据结构以及对性能监控与业务决策的价值。

---

## 一、实现机制

SDK 通过集成 Google 推荐的 `web-vitals` 库，并将其作为一种特殊的“性能事件”纳入统一的埋点上报体系。

### 1.1 核心采集流程

```typescript
// src/utils/performance.ts 中的核心逻辑

import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import AnalyticsSDK from '@/sdk';

/**
 * 发送性能指标到分析服务
 */
function sendToAnalytics(metric: Metric) {
  const sdk = AnalyticsSDK.getInstance(projectId, endpoint);
  
  if (sdk) {
    // 统一调用 sdk.track 方法，将性能指标作为一种事件类型
    sdk.track('web_vitals', {
      指标名称: metric.name,
      指标值: metric.value,
      评级: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      指标ID: metric.id,
      页面URL: window.location.href,
      // 自动附带环境上下文
      连接类型: (navigator as any).connection?.effectiveType || 'unknown',
      设备内存: (navigator as any).deviceMemory || 'unknown',
      硬件并发: navigator.hardwareConcurrency || 'unknown',
    }, 'high'); // 性能数据使用高优先级上报
  }
}

// 注册监听
export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}
```

### 1.2 采集的指标说明

| 指标 | 全称 | 说明 | 业务意义 |
| :--- | :--- | :--- | :--- |
| **FCP** | First Contentful Paint | 首次内容绘制 | 用户感知页面的加载速度 |
| **LCP** | Largest Contentful Paint | 最大内容绘制 | 页面主要内容的渲染效率 |
| **CLS** | Cumulative Layout Shift | 累积布局偏移 | 页面视觉稳定性（是否抖动） |
| **TTFB** | Time to First Byte | 首字节时间 | 服务器响应速度与网络延迟 |
| **INP** | Interaction to Next Paint | 交互到下次绘制 | 页面交互的流畅度（替代 FID） |

---

## 二、数据结合的优势

将性能数据与埋点数据“统一化”处理，打破了性能监控与业务分析之间的壁垒。

### 2.1 丰富的多维分析

通过 SDK 自动附带的公共参数（Common Params），性能数据不再是孤立的数值，而是拥有了完整的上下文：

- **设备维度**：分析不同品牌、不同内存大小设备的性能差异。
- **网络维度**：分析 4G/5G/WiFi 环境下 LCP 的真实表现。
- **用户维度**：关联 UID，分析高价值用户是否遭遇了性能瓶颈。
- **版本维度**：对比不同 SDK 版本或应用版本发布后的性能变化。

### 2.2 性能与业务的关联（Correlative Analysis）

这是数据结合的核心价值所在：

1.  **性能对转化率的影响**：
    - *分析场景*：将 `purchase_click` 事件与 `LCP` 指标结合。
    - *决策参考*：当 LCP 超过 3s 时，用户的下单转化率下降了多少百分比？
2.  **跳出率诊断**：
    - *分析场景*：关联 `page_view` 与 `TTFB`。
    - *决策参考*：高跳出率的页面是否是因为首字节时间过长导致的？
3.  **交互流失分析**：
    - *分析场景*：关联 `button_click` 与 `INP`。
    - *决策参考*：用户点击按钮后无响应（INP 评分差）是否是导致任务流失的主因？

---

## 三、对性能监控的增强

### 3.1 优先级调度

利用 SDK 内置的**优先级队列**，Web Vitals 数据被标记为 `high` 优先级。

- **优势**：确保性能异常（如 Poor 评级的 CLS）能被立即上报，而不是在本地队列中等待，从而提高监控的实时性。

### 3.2 离线存储与弱网支持

由于性能指标往往在网络状况较差时最差，SDK 的**离线存储**机制显得尤为重要。

- **优势**：即使在极端弱网下导致上报失败，性能数据也会通过压缩存储在本地，待网络恢复后“补报”。这避免了“只采集到好网数据，丢失了差网数据”的幸存者偏差。

---

## 四、对业务决策的帮助

1.  **资源投入优先级**：
    - 如果数据显示 80% 的用户 LCP 为 'good'，但 CLS 在移动端普遍为 'poor'，业务方应优先排查页面布局抖动问题，而不是盲目优化图片加载。
2.  **A/B 测试的性能视角**：
    - 在进行新功能 A/B 测试时，不仅关注业务指标（点击率），同时观察两个方案的 `web_vitals` 差异，避免为了功能而牺牲用户体验。
3.  **ROI 评估**：
    - 评估性能优化后的业务收益。例如：“将平均 LCP 从 2.5s 优化到 1.8s 后，注册转化率提升了 5%”，为技术债务的偿还提供有力的数据支撑。

---

## 五、总结

通过将 Web Vitals 深度集成到埋点 SDK 中，我们实现了：
- **监控的一致性**：性能也是一种“用户行为”，即“用户等待的行为”。
- **分析的全貌性**：从技术指标到业务指标的无缝链路。
- **决策的科学性**：基于真实用户体验数据的业务优化方向。

这套方案不仅是一个技术采集工具，更是连接“前端性能”与“商业价值”的桥梁。

