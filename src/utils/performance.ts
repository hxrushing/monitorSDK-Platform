import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';
import { init } from '@/sdk';
import type { SDKInstance } from '@/sdk';

/**
 * Web Vitals 性能指标类型
 */
export type PerformanceMetric = Metric;

type ReportHandler = (metric: PerformanceMetric) => void;

// 缓存SDK实例
let cachedSDKInstance: SDKInstance | null = null;

// 性能采集启用状态（默认开启）
let isPerformanceCollectionEnabled = true;

/**
 * 获取当前项目的 SDK 实例
 * 如果 SDK 未初始化，返回 null
 * 如果性能采集已禁用，返回 null
 */
function getSDKInstance(): SDKInstance | null {
  // 如果性能采集已禁用，不初始化SDK
  if (!isPerformanceCollectionEnabled) {
    return null;
  }

  try {
    // 如果已有缓存的实例，直接返回
    if (cachedSDKInstance) {
      return cachedSDKInstance;
    }

    // 尝试从全局存储获取项目ID
    let projectId = (window as any).__ANALYTICS_PROJECT_ID__;
    
    // 如果全局变量没有，尝试从 localStorage 获取
    if (!projectId) {
      const storedProjectId = localStorage.getItem('selectedProjectId');
      // 不返回 demo-project 作为默认值
      if (storedProjectId && storedProjectId !== 'demo-project') {
        projectId = storedProjectId;
      }
    }
    
    // 如果项目ID为空或者是 demo-project，不初始化SDK
    if (!projectId || projectId === 'demo-project') {
      return null;
    }

    // 直接使用相对路径 /api
    const endpoint = '/api/track';
    
    // 如果性能采集已禁用，不初始化任何探针
    cachedSDKInstance = init({
      projectId,
      endpoint,
      enable: {
        error: false,
        http: false,
        perf: false,
        behavior: false,
        blankScreen: false,
      },
    });
    return cachedSDKInstance;
  } catch (error) {
    console.warn('[Performance] SDK 未初始化，性能数据将仅输出到控制台');
    return null;
  }
}

/**
 * 发送性能指标到分析服务
 */
function sendToAnalytics(metric: PerformanceMetric) {
  // 如果性能采集已禁用，直接返回
  if (!isPerformanceCollectionEnabled) {
    return;
  }

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

  // 同时发送到分析服务（sendToAnalytics 内部会检查启用状态）
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics); // INP 替代了 FID
}

/**
 * 启用性能采集
 */
export function enablePerformanceMonitoring() {
  isPerformanceCollectionEnabled = true;
  if (import.meta.env.DEV) {
    console.log('[Performance] 性能采集已启用');
  }
}

/**
 * 禁用性能采集
 */
export function disablePerformanceMonitoring() {
  isPerformanceCollectionEnabled = false;
  if (import.meta.env.DEV) {
    console.log('[Performance] 性能采集已禁用');
  }
}

/**
 * 获取当前性能采集状态
 */
export function getPerformanceCollectionEnabled(): boolean {
  return isPerformanceCollectionEnabled;
}

/**
 * 设置性能采集状态
 */
export function setPerformanceCollectionEnabled(enabled: boolean) {
  isPerformanceCollectionEnabled = enabled;
  
  // 如果禁用性能采集，销毁已存在的SDK实例和所有探针
  if (!enabled && cachedSDKInstance) {
    try {
      // 获取SDKCore实例并销毁
      let projectId = (window as any).__ANALYTICS_PROJECT_ID__;
      if (!projectId) {
        const storedProjectId = localStorage.getItem('selectedProjectId');
        if (storedProjectId && storedProjectId !== 'demo-project') {
          projectId = storedProjectId;
        }
      }
      // 如果没有有效的项目ID，跳过销毁
      if (!projectId || projectId === 'demo-project') {
        cachedSDKInstance = null;
        return;
      }
      const endpoint = '/api/track';
      
      // 导入SDKCore以访问静态方法和实例
      import('@/sdk/core/api').then((module) => {
        const SDKCore = module.SDKCore as any;
        const key = `${projectId}-${endpoint}`;
        
        // 获取实例并销毁
        if (SDKCore.instances && SDKCore.instances.has(key)) {
          const instance = SDKCore.instances.get(key);
          if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
          }
        }
      }).catch((err) => {
        console.warn('[Performance] 销毁SDK实例时出错:', err);
      });
      
      cachedSDKInstance = null;
    } catch (error) {
      console.warn('[Performance] 销毁SDK实例时出错:', error);
      cachedSDKInstance = null;
    }
  }
  
  if (import.meta.env.DEV) {
    console.log(`[Performance] 性能采集已${enabled ? '启用' : '禁用'}`);
  }
}

/**
 * 初始化性能监控
 * 需要在应用启动时调用
 * @param projectId 项目ID，如果不提供则从 localStorage 读取
 * @param enabled 是否启用性能采集，如果不提供则从 localStorage 读取
 */
export function initPerformanceMonitoring(projectId?: string, enabled?: boolean) {
  // 获取项目ID，不返回 demo-project 作为默认值
  let finalProjectId = projectId;
  if (!finalProjectId) {
    const storedProjectId = localStorage.getItem('selectedProjectId');
    if (storedProjectId && storedProjectId !== 'demo-project') {
      finalProjectId = storedProjectId;
    }
  }
  
  // 如果没有有效的项目ID，不初始化性能监控
  if (!finalProjectId || finalProjectId === 'demo-project') {
    if (import.meta.env.DEV) {
      console.log('[Performance] 未提供有效的项目ID，跳过性能监控初始化');
    }
    return;
  }
  
  // 获取性能采集状态（如果未传入，从 localStorage 读取）
  if (enabled === undefined) {
    const stored = localStorage.getItem('performanceCollectionEnabled');
    isPerformanceCollectionEnabled = stored !== null ? stored === 'true' : true;
  } else {
    isPerformanceCollectionEnabled = enabled;
  }
  
  // 将项目ID存储到全局，供 SDK 使用
  (window as any).__ANALYTICS_PROJECT_ID__ = finalProjectId;

  // 注册性能监控（sendToAnalytics 内部会检查启用状态）
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
      // 监听性能采集状态变化
      if (e.key === 'performanceCollectionEnabled') {
        isPerformanceCollectionEnabled = e.newValue === 'true';
        if (import.meta.env.DEV) {
          console.log('[Performance] 性能采集状态已更新:', isPerformanceCollectionEnabled);
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
    console.log('[Performance] Web Vitals 性能监控已初始化，项目ID:', finalProjectId);
    console.log('[Performance] 性能采集状态:', isPerformanceCollectionEnabled ? '已启用' : '已禁用');
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
  return {
    metrics: [],
    overall: 'good'
  };
}

// 导出工具函数
export { formatMetric, getMetricThresholds };

