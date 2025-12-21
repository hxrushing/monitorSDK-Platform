/**
 * 传输层类型定义
 */

/**
 * 自适应批量大小配置
 */
export interface AdaptiveBatchConfig {
  enabled: boolean;
  minBatchSize: number;
  maxBatchSize: number;
  initialBatchSize: number;
  queueLengthWeight: number;
  networkQualityWeight: number;
  adjustmentInterval: number;
  networkCheckInterval: number;
}

/**
 * 指数退避配置
 */
export interface ExponentialBackoffConfig {
  enabled: boolean;
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
  jitterEnabled: boolean;
  jitterRatio: number;
  networkAware: boolean;
  errorTypeAware: boolean;
}

/**
 * 错误类型枚举
 */
export type ErrorType = 'network' | 'timeout' | 'server' | 'client' | 'unknown';

/**
 * 重试记录
 */
export interface RetryRecord {
  eventId: string;
  retryCount: number;
  lastRetryTime: number;
  nextRetryTime: number;
  backoffDelay: number;
  errorType: ErrorType;
  errorMessage?: string;
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'auto' | 'native' | 'custom' | 'none';
  minSize: number;
  compressionLevel: number;
  deduplicate: boolean;
  optimizeJson: boolean;
}

/**
 * 压缩统计信息
 */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  compressionTime: number;
  decompressionTime: number;
}

/**
 * 批量发送配置
 */
export interface BatchConfig {
  maxBatchSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
  enableOfflineStorage: boolean;
  maxStorageSize: number;
  adaptive?: AdaptiveBatchConfig;
  exponentialBackoff?: ExponentialBackoffConfig;
  compression?: CompressionConfig;
}

