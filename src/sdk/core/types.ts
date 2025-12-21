/**
 * SDK 核心类型定义
 * 统一的事件格式和公共类型
 */

/**
 * 统一事件格式
 */
export interface UnifiedEvent {
  projectId: string;
  eventType: string; // 事件类型: error, http, perf, page_view, custom等
  payload: Record<string, any>; // 事件载荷
  ts: number; // 时间戳
  device: DeviceInfo; // 设备信息
  sdkVersion: string; // SDK版本
  uid?: string; // 用户ID（可选）
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
}

/**
 * 事件优先级
 */
export type EventPriority = 'high' | 'normal' | 'low';

/**
 * 事件队列项
 */
export interface QueuedEvent {
  id: string;
  event: UnifiedEvent;
  timestamp: number;
  retryCount: number;
  priority: EventPriority;
}

/**
 * 批量上报响应
 */
export interface BatchResponse {
  success: boolean;
  processedCount: number;
  failedEvents?: QueuedEvent[];
}

