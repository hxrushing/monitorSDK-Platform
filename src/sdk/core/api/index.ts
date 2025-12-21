/**
 * SDK API 层
 * init / track / trackError / trackPage / trackHttp / trackPerf / flush
 */

import { Transport } from '../transport';
import { UnifiedEvent, DeviceInfo } from '../types';
import { SDKConfig, mergeConfig, validateConfig, ProbeEnableConfig } from '../../config';
import { Probe } from '../../types/probes';

/**
 * SDK实例接口
 */
export interface SDKInstance {
  track: (eventName: string, eventParams?: Record<string, any>, priority?: 'high' | 'normal' | 'low') => void;
  trackError: (errorType: string, errorDetails: Record<string, any>) => void;
  trackPage: (path: string, extra?: Record<string, any>) => void;
  trackHttp: (info: {
    url: string;
    method: string;
    status?: number;
    duration?: number;
    requestSize?: number;
    responseSize?: number;
    extra?: Record<string, any>;
  }) => void;
  trackPerf: (metrics: Record<string, any>) => void;
  flush: () => Promise<void>;
  setUser: (uid: string) => void;
}

/**
 * SDK核心类
 */
export class SDKCore {
  private static instances: Map<string, SDKCore> = new Map();

  private transport: Transport;
  private config: Required<SDKConfig>;
  private probes: Map<string, Probe> = new Map();
  private deviceInfo: DeviceInfo;
  private sdkVersion: string = '1.0.0';

  private constructor(config: SDKConfig) {
    // 验证配置
    const errors = validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`SDK配置错误: ${errors.join(', ')}`);
    }

    // 合并配置
    this.config = mergeConfig(config);

    // 获取设备信息
    this.deviceInfo = this.getDeviceInfo();

    // 初始化传输管道
    this.transport = new Transport(
      this.config.projectId,
      this.config.endpoint,
      this.deviceInfo,
      this.sdkVersion,
      this.config.batch
    );

    // 初始化探针（如果启用）
    this.initProbes();
  }

  /**
   * 初始化探针
   */
  private initProbes(): void {
    // 动态导入错误探针（避免循环依赖）
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
          // 直接使用trackHttp方法上报
          this.trackHttp({
            url: payload.url,
            method: payload.method,
            status: payload.status,
            duration: payload.duration,
            requestSize: payload.requestSize,
            responseSize: payload.responseSize,
            extra: payload,
          });
        });
        this.probes.set(probe.name, probe);
      }).catch(err => {
        console.warn('加载HTTP探针失败:', err);
      });
    }

    // 动态导入性能探针
    if (this.config.enable.perf) {
      import('../../probes/performance').then(({ PerformanceProbe }) => {
        const probe = new PerformanceProbe({
          sampleRate: this.config.sampleRate.perf,
          longTaskSampleRate: this.config.sampleRate.longTask,
        });
        probe.init((_eventType, payload) => {
          this.trackPerf(payload);
        });
        this.probes.set(probe.name, probe);
      }).catch(err => {
        console.warn('加载性能探针失败:', err);
      });
    }

    // 动态导入行为探针
    if (this.config.enable.behavior) {
      import('../../probes/behavior').then(({ BehaviorProbe }) => {
        const probe = new BehaviorProbe(this.config.behavior);
        probe.init((eventType, payload, priority) => {
          if (eventType === 'page_view') {
            this.trackPage(payload.path, payload);
          } else {
            this.track(eventType, payload, priority);
          }
        });
        this.probes.set(probe.name, probe);
      }).catch(err => {
        console.warn('加载行为探针失败:', err);
      });
    }
  }

  /**
   * 获取或创建SDK实例
   */
  public static getInstance(config: SDKConfig): SDKCore {
    const key = `${config.projectId}-${config.endpoint}`;
    if (!SDKCore.instances.has(key)) {
      SDKCore.instances.set(key, new SDKCore(config));
    }
    return SDKCore.instances.get(key)!;
  }

  /**
   * 注册探针
   */
  public registerProbe(probe: Probe): void {
    if (this.config.enable[probe.name as keyof ProbeEnableConfig]) {
      this.probes.set(probe.name, probe);
      // 传递事件上报函数给探针
      probe.init((eventType, payload, priority) => {
        if (eventType === 'error') {
          this.trackError(payload.errorType || 'unknown', payload);
        } else {
          this.track(eventType, payload, priority);
        }
      });
    }
  }

  /**
   * 卸载探针
   */
  public unregisterProbe(name: string): void {
    const probe = this.probes.get(name);
    if (probe) {
      probe.destroy();
      this.probes.delete(name);
    }
  }

  /**
   * 创建事件
   */
  private createEvent(eventType: string, payload: Record<string, any>): UnifiedEvent {
    return {
      projectId: this.config.projectId,
      eventType,
      payload,
      ts: Date.now(),
      device: this.deviceInfo,
      sdkVersion: this.sdkVersion,
    };
  }

  /**
   * 跟踪自定义事件
   */
  public track(eventName: string, eventParams?: Record<string, any>, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    // 采样率检查
    if (this.config.sampleRate.behavior !== undefined && Math.random() > this.config.sampleRate.behavior) {
      if (this.config.debug) {
        console.log(`[SDK] 事件被采样过滤: ${eventName}`);
      }
      return;
    }

    const event = this.createEvent(eventName, eventParams || {});
    if (this.config.debug) {
      console.log(`[SDK] 跟踪事件: ${eventName}`, eventParams);
    }
    this.transport.addEvent(event, priority);
  }

  /**
   * 跟踪错误
   */
  public trackError(errorType: string, errorDetails: Record<string, any>): void {
    // 采样率检查
    if (this.config.sampleRate.error !== undefined && Math.random() > this.config.sampleRate.error) {
      return;
    }

    const event = this.createEvent('error', {
      errorType,
      ...errorDetails,
    });
    this.transport.addEvent(event, 'high');
  }

  /**
   * 跟踪页面浏览
   */
  public trackPage(path: string, extra?: Record<string, any>): void {
    const event = this.createEvent('page_view', {
      path,
      title: document.title,
      referrer: document.referrer,
      ...extra,
    });
    this.transport.addEvent(event, 'normal');
  }

  /**
   * 跟踪HTTP请求
   */
  public trackHttp(info: {
    url: string;
    method: string;
    status?: number;
    duration?: number;
    requestSize?: number;
    responseSize?: number;
    extra?: Record<string, any>;
  }): void {
    // URL忽略检查
    if (this.config.http.ignoreUrls && this.shouldIgnoreUrl(info.url)) {
      return;
    }

    // 采样率检查
    if (this.config.sampleRate.http !== undefined && Math.random() > this.config.sampleRate.http) {
      return;
    }

    const event = this.createEvent('http', {
      url: info.url,
      method: info.method,
      status: info.status,
      duration: info.duration,
      requestSize: info.requestSize,
      responseSize: info.responseSize,
      ...info.extra,
    });
    this.transport.addEvent(event, 'normal');
  }

  /**
   * 跟踪性能指标
   */
  public trackPerf(metrics: Record<string, any>): void {
    // 采样率检查
    if (this.config.sampleRate.perf !== undefined && Math.random() > this.config.sampleRate.perf) {
      return;
    }

    const event = this.createEvent('perf', metrics);
    this.transport.addEvent(event, 'normal');
  }

  /**
   * 刷新队列
   */
  public async flush(): Promise<void> {
    if (this.config.debug) {
      console.log('[SDK] 手动刷新队列');
    }
    await this.transport.flush();
  }

  /**
   * 设置用户ID
   */
  public setUser(uid: string): void {
    this.transport.setUser(uid);
  }

  /**
   * 获取设备信息
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  }

  /**
   * 判断URL是否应该被忽略
   */
  private shouldIgnoreUrl(url: string): boolean {
    if (!this.config.http.ignoreUrls || this.config.http.ignoreUrls.length === 0) {
      return false;
    }

    return this.config.http.ignoreUrls.some(pattern => {
      if (typeof pattern === 'string') {
        return url.includes(pattern);
      }
      return pattern.test(url);
    });
  }

  /**
   * 销毁SDK实例
   */
  public destroy(): void {
    // 销毁所有探针
    this.probes.forEach(probe => probe.destroy());
    this.probes.clear();

    // 销毁传输管道
    this.transport.destroy();

    // 从实例映射中移除
    const key = `${this.config.projectId}-${this.config.endpoint}`;
    SDKCore.instances.delete(key);
  }
}

/**
 * 初始化SDK
 */
export function init(config: SDKConfig): SDKInstance {
  const sdk = SDKCore.getInstance(config);

  return {
    track: (eventName, eventParams, priority) => sdk.track(eventName, eventParams, priority),
    trackError: (errorType, errorDetails) => sdk.trackError(errorType, errorDetails),
    trackPage: (path, extra) => sdk.trackPage(path, extra),
    trackHttp: (info) => sdk.trackHttp(info),
    trackPerf: (metrics) => sdk.trackPerf(metrics),
    flush: () => sdk.flush(),
    setUser: (uid) => sdk.setUser(uid),
  };
}

