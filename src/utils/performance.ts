import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';
import AnalyticsSDK from '@/sdk';

/**
 * Web Vitals 性能指标类型
 */
export interface PerformanceMetric extends Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

type ReportHandler = (metric: PerformanceMetric) => void;

/**
 * 获取当前项目的 SDK 实例
 * 如果 SDK 未初始化，返回 null
 */
function getSDKInstance(): AnalyticsSDK | null {
  try {
    // 尝试从全局存储获取项目ID
    let projectId = (window as any).__ANALYTICS_PROJECT_ID__;
    
    // 如果全局变量没有，尝试从 localStorage 获取
    if (!projectId) {
      const storedProjectId = localStorage.getItem('selectedProjectId');
      projectId = storedProjectId || 'demo-project';
    }
    
    if (!projectId) {
      return null;
    }

    const endpoint = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api') + '/track';
    return AnalyticsSDK.getInstance(projectId, endpoint);
  } catch (error) {
    console.warn('[Performance] SDK 未初始化，性能数据将仅输出到控制台');
    return null;
  }
}

/**
 * 发送性能指标到分析服务
 */
function sendToAnalytics(metric: PerformanceMetric) {
  const sdk = getSDKInstance();
  
  if (sdk) {
    // 通过 SDK 发送性能数据
    sdk.track('web_vitals', {
      指标名称: metric.name,
      指标值: metric.value,
      评级: metric.rating,
      变化量: metric.delta,
      指标ID: metric.id,
      页面URL: window.location.href,
      页面路径: window.location.pathname,
      时间戳: Date.now(),
      // 添加更多上下文信息
      用户代理: navigator.userAgent,
      连接类型: (navigator as any).connection?.effectiveType || 'unknown',
      设备内存: (navigator as any).deviceMemory || 'unknown',
      硬件并发: navigator.hardwareConcurrency || 'unknown',
    }, 'high'); // 性能数据使用高优先级
  }

  // 开发环境输出到控制台
  if (import.meta.env.DEV) {
    const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
    console.log(
      `[Performance] ${emoji} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      {
        delta: metric.delta,
        id: metric.id,
        url: window.location.href
      }
    );
  }
}

/**
 * 格式化性能指标为可读字符串
 */
function formatMetric(metric: PerformanceMetric): string {
  const unit = metric.name === 'CLS' ? '' : 'ms';
  return `${metric.name}: ${metric.value.toFixed(2)}${unit} (${metric.rating})`;
}

/**
 * 获取性能指标的阈值信息
 */
function getMetricThresholds(name: string): { good: number; needsImprovement: number } {
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    FCP: { good: 1800, needsImprovement: 3000 },
    LCP: { good: 2500, needsImprovement: 4000 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    TTFB: { good: 800, needsImprovement: 1800 },
    INP: { good: 200, needsImprovement: 500 }, // INP 替代了 FID
  };
  return thresholds[name] || { good: 0, needsImprovement: 0 };
}

/**
 * 注册所有 Web Vitals 性能监控
 * @param onPerfEntry 可选的性能指标回调函数（用于自定义处理）
 */
export function reportWebVitals(onPerfEntry?: ReportHandler) {
  if (onPerfEntry && typeof onPerfEntry === 'function') {
    // 注册自定义回调
    // 注意：onFID 在 web-vitals v5 中已被移除，由 onINP 替代
    onCLS(onPerfEntry);
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
    onINP(onPerfEntry); // INP 替代了 FID
  }

  // 同时发送到分析服务
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics); // INP 替代了 FID
}

/**
 * 初始化性能监控
 * 需要在应用启动时调用
 * @param projectId 项目ID，如果不提供则从 localStorage 读取
 */
export function initPerformanceMonitoring(projectId?: string) {
  // 获取项目ID
  const finalProjectId = projectId || localStorage.getItem('selectedProjectId') || 'demo-project';
  
  // 将项目ID存储到全局，供 SDK 使用
  (window as any).__ANALYTICS_PROJECT_ID__ = finalProjectId;

  // 注册性能监控
  reportWebVitals();

  // 监听项目ID变化（通过监听 storage 事件，适用于跨标签页）
  if (typeof window !== 'undefined') {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedProjectId' && e.newValue) {
        (window as any).__ANALYTICS_PROJECT_ID__ = e.newValue;
        if (import.meta.env.DEV) {
          console.log('[Performance] 项目ID已更新:', e.newValue);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 监听同页面的 localStorage 变化（通过自定义事件机制）
    // 注意：这需要在设置 localStorage 的地方手动触发，或者使用 Proxy
    // 这里我们提供一个更新函数供外部调用
    (window as any).__UPDATE_PERFORMANCE_PROJECT_ID__ = (newProjectId: string) => {
      (window as any).__ANALYTICS_PROJECT_ID__ = newProjectId;
      if (import.meta.env.DEV) {
        console.log('[Performance] 项目ID已更新:', newProjectId);
      }
    };
  }

  if (import.meta.env.DEV) {
    console.log('[Performance] Web Vitals 性能监控已启用，项目ID:', finalProjectId);
    console.log('[Performance] 监控指标: FCP, LCP, FID, CLS, TTFB, INP');
  }
}

/**
 * 获取当前页面的性能指标摘要
 */
export function getPerformanceSummary(): {
  metrics: Array<{ name: string; value: number; rating: string; formatted: string }>;
  overall: 'good' | 'needs-improvement' | 'poor';
} {
  // 这个函数主要用于开发调试，实际指标通过 Web Vitals 回调获取
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  return {
    metrics: [],
    overall: 'good'
  };
}

// 导出工具函数
export { formatMetric, getMetricThresholds };

