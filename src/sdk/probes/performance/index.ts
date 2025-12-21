/**
 * 性能探针
 * FCP/LCP/CLS/TTFB/INP、长任务采集
 * PerformanceObserver采集，支持采样率控制
 */

import { Probe, EventReporter } from '../../types/probes';

interface PerformanceProbeConfig {
  sampleRate?: number;
  longTaskSampleRate?: number;
}

/**
 * 性能探针实现
 */
export class PerformanceProbe implements Probe {
  public readonly name = 'perf';
  public enabled: boolean = true;

  private reporter?: EventReporter;
  private config?: PerformanceProbeConfig;
  private longTaskObserver?: PerformanceObserver;
  
  // 标记是否已注册web-vitals
  private webVitalsRegistered: boolean = false;

  constructor(config?: PerformanceProbeConfig) {
    this.config = config;
  }

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 采样率检查
    const sampleRate = this.config?.sampleRate ?? 1.0;
    if (Math.random() > sampleRate) {
      return; // 被采样过滤
    }

    // 注册Web Vitals监控（动态导入，避免增加bundle大小）
    this.initWebVitals();

    // 监控长任务
    this.initLongTaskObserver();

    // 可选：监控资源加载
    // this.initResourceObserver();
  }

  destroy(): void {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = undefined;
    }

    // if (this.resourceObserver) {
    //   this.resourceObserver.disconnect();
    //   this.resourceObserver = undefined;
    // }

    this.webVitalsRegistered = false;
  }

  /**
   * 初始化Web Vitals监控
   */
  private initWebVitals(): void {
    if (this.webVitalsRegistered) return;

    // 动态导入web-vitals，避免增加初始bundle大小
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
          // entries: metric.entries, // 可以包含原始entries，但数据量较大
        }, 'normal');
      };

      // 注册所有Web Vitals指标
      onCLS(sendMetric);
      onFCP(sendMetric);
      onLCP(sendMetric);
      onTTFB(sendMetric);
      onINP(sendMetric); // INP替代了FID

      this.webVitalsRegistered = true;
    }).catch(err => {
      console.warn('[Performance Probe] 加载web-vitals失败:', err);
    });
  }

  /**
   * 初始化长任务监控
   */
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

  // 资源加载监控（可选功能，暂未实现）
  // 如果需要启用，可以实现此方法来监控资源加载性能
  // private initResourceObserver(): void { ... }
}

