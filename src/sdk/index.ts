/**
 * 可插拔探针SDK
 * 统一的SDK入口，支持npm和CDN两种方式接入
 */

// 导出核心API
export { init, SDKCore } from './core/api';
export type { SDKInstance } from './core/api';
export type { SDKConfig, ProbeEnableConfig, SampleRateConfig, HttpProbeConfig, BehaviorProbeConfig } from './config';

// 导出类型定义
export type { UnifiedEvent, DeviceInfo, EventPriority } from './core/types';
export type { BatchConfig, AdaptiveBatchConfig, ExponentialBackoffConfig, CompressionConfig, ErrorType, RetryRecord } from './types/transport';
export type { Probe, BlankScreenConfig, ErrorEventData, HttpEventData, PerfEventData, PageViewEventData } from './types/probes';

// 导出配置相关
export { DEFAULT_CONFIG, validateConfig, mergeConfig, shouldIgnoreUrl, maskSensitiveData } from './config';

// 导出探针（用于测试和高级用法）
export { ErrorProbe } from './probes/error';
export { HttpProbe } from './probes/http';
export { PerformanceProbe } from './probes/performance';
export { BehaviorProbe } from './probes/behavior';

// 默认导出init函数（用于CDN方式）
export { init as default } from './core/api';
