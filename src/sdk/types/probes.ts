/**
 * 探针类型定义
 */

/**
 * 白屏检测配置
 */
export interface BlankScreenConfig {
  enabled: boolean;
  checkInterval: number;
  rootSelector: string;
  threshold: number;
  checkElements: string[];
}

/**
 * 事件上报回调函数类型
 */
export type EventReporter = (eventType: string, payload: Record<string, any>, priority?: 'high' | 'normal' | 'low') => void;

/**
 * 探针接口
 * 所有探针模块必须实现此接口
 */
export interface Probe {
  /**
   * 探针名称
   */
  name: string;

  /**
   * 初始化探针
   * @param reporter 事件上报函数
   */
  init(reporter: EventReporter): void;

  /**
   * 销毁探针
   */
  destroy(): void;

  /**
   * 是否启用
   */
  enabled: boolean;
}

/**
 * 错误事件数据
 */
export interface ErrorEventData {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  errorType?: 'js' | 'promise' | 'resource';
  url?: string;
}

/**
 * HTTP事件数据
 */
export interface HttpEventData {
  url: string;
  method: string;
  status?: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

/**
 * 性能事件数据
 */
export interface PerfEventData {
  metric: string; // FCP, LCP, CLS, TTFB, INP等
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  entries?: any[];
}

/**
 * 页面浏览事件数据
 */
export interface PageViewEventData {
  path: string;
  title?: string;
  referrer?: string;
  stayDuration?: number;
}

