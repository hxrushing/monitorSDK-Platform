/**
 * SDK 配置系统
 * 可配置开关、采样率、忽略规则、脱敏规则
 */

import { BatchConfig } from '../types/transport';
import { BlankScreenConfig } from '../types/probes';

/**
 * 探针开关配置
 */
export interface ProbeEnableConfig {
  error?: boolean;        // 错误探针
  http?: boolean;         // HTTP探针
  perf?: boolean;         // 性能探针
  behavior?: boolean;     // 行为探针
  blankScreen?: boolean;  // 白屏检测
  resource?: boolean;     // 资源探针
}

/**
 * 采样率配置
 */
export interface SampleRateConfig {
  perf?: number;         // 性能指标采样率 (0-1)
  longTask?: number;     // 长任务采样率 (0-1)
  http?: number;         // HTTP请求采样率 (0-1)
  error?: number;        // 错误采样率 (0-1)
  behavior?: number;     // 行为采样率 (0-1)
}

/**
 * HTTP探针配置
 */
export interface HttpProbeConfig {
  ignoreUrls?: Array<string | RegExp>;  // 忽略的URL列表（字符串或正则）
  maskHeaders?: string[];                // 需要脱敏的请求头字段
  maskBodyKeys?: string[];               // 需要脱敏的请求体字段
  includeRequestBody?: boolean;          // 是否包含请求体
  includeResponseBody?: boolean;         // 是否包含响应体
  maxBodySize?: number;                  // 最大请求/响应体大小（字节）
}

/**
 * 行为探针配置
 */
export interface BehaviorProbeConfig {
  autoPV?: boolean;          // 自动PV上报
  autoRoute?: boolean;       // 自动路由切换监听
  trackClick?: boolean;      // 点击事件采集
  trackExposure?: boolean;   // 曝光事件采集
  sessionTimeout?: number;   // 会话超时时间（毫秒）
}

/**
 * SDK初始化配置
 */
export interface SDKConfig {
  projectId: string;
  endpoint: string;
  enable?: ProbeEnableConfig;
  sampleRate?: SampleRateConfig;
  http?: HttpProbeConfig;
  behavior?: BehaviorProbeConfig;
  blankScreen?: Partial<BlankScreenConfig>;
  batch?: Partial<BatchConfig>;
  debug?: boolean; // 调试模式
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Required<Omit<SDKConfig, 'projectId' | 'endpoint'>> = {
  enable: {
    error: true,
    http: true,
    perf: true,
    behavior: true,
    blankScreen: true,
    resource: false,
  },
  sampleRate: {
    perf: 1.0,
    longTask: 1.0,
    http: 1.0,
    error: 1.0,
    behavior: 1.0,
  },
  http: {
    ignoreUrls: [],
    maskHeaders: ['Authorization', 'Cookie'],
    maskBodyKeys: ['token', 'password', 'pwd'],
    includeRequestBody: false,
    includeResponseBody: false,
    maxBodySize: 10 * 1024, // 10KB
  },
  behavior: {
    autoPV: true,
    autoRoute: true,
    trackClick: false,
    trackExposure: false,
    sessionTimeout: 30 * 60 * 1000, // 30分钟
  },
  blankScreen: {
    enabled: true,
    checkInterval: 3000,
    rootSelector: '#root',
    threshold: 5000,
    checkElements: ['#root', 'body'],
  },
  batch: {
    maxBatchSize: 50,
    flushInterval: 5000,
    maxRetries: 3,
    retryDelay: 1000,
    enableOfflineStorage: true,
    maxStorageSize: 1024 * 1024, // 1MB
  },
  debug: false,
};

/**
 * 配置验证
 */
export function validateConfig(config: SDKConfig): string[] {
  const errors: string[] = [];

  if (!config.projectId) {
    errors.push('projectId is required');
  }

  if (!config.endpoint) {
    errors.push('endpoint is required');
  }

  if (config.sampleRate) {
    Object.entries(config.sampleRate).forEach(([key, value]) => {
      if (value !== undefined && (value < 0 || value > 1)) {
        errors.push(`sampleRate.${key} must be between 0 and 1`);
      }
    });
  }

  return errors;
}

/**
 * 合并配置
 */
export function mergeConfig(userConfig: SDKConfig): Required<SDKConfig> {
  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    enable: {
      ...DEFAULT_CONFIG.enable,
      ...userConfig.enable,
    },
    sampleRate: {
      ...DEFAULT_CONFIG.sampleRate,
      ...userConfig.sampleRate,
    },
    http: {
      ...DEFAULT_CONFIG.http,
      ...userConfig.http,
    },
    behavior: {
      ...DEFAULT_CONFIG.behavior,
      ...userConfig.behavior,
    },
    blankScreen: {
      ...DEFAULT_CONFIG.blankScreen,
      ...userConfig.blankScreen,
    },
    batch: {
      ...DEFAULT_CONFIG.batch,
      ...userConfig.batch,
    },
  };

  return merged as Required<SDKConfig>;
}

/**
 * 判断URL是否应该被忽略
 */
export function shouldIgnoreUrl(url: string, ignoreUrls?: Array<string | RegExp>): boolean {
  if (!ignoreUrls || ignoreUrls.length === 0) {
    return false;
  }

  return ignoreUrls.some(pattern => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

/**
 * 脱敏处理
 */
export function maskSensitiveData(
  data: Record<string, any>,
  keys: string[],
  maskChar: string = '***'
): Record<string, any> {
  const masked = { ...data };
  keys.forEach(key => {
    if (key in masked) {
      masked[key] = maskChar;
    }
  });
  return masked;
}

