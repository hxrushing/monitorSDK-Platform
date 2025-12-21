/**
 * 传输管道核心实现
 * 批量队列、自适应批量、指数退避、Beacon、离线缓存、压缩
 */

import { UnifiedEvent, QueuedEvent, BatchResponse, EventPriority, DeviceInfo } from '../types';
import { BatchConfig, ErrorType, RetryRecord } from '../../types/transport';
import { generateUUID } from '../../utils/uuid';

/**
 * 传输管道
 */
export class Transport {
  private eventQueue: QueuedEvent[] = [];
  private batchConfig: BatchConfig;
  private endpoint: string;
  private projectId: string;
  private deviceInfo: DeviceInfo;
  private sdkVersion: string;
  private uid?: string;

  // 定时器
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private storageKey: string;

  // Beacon API 支持
  private beaconSupported: boolean = typeof navigator !== 'undefined' && 'sendBeacon' in navigator;

  // 自适应批量大小
  private currentBatchSize: number;
  private networkMetrics: any = null;
  private networkCheckTimer: NodeJS.Timeout | null = null;
  private adjustmentTimer: NodeJS.Timeout | null = null;
  private recentSendResults: Array<{ success: boolean; duration: number; batchSize: number }> = [];

  // 指数退避
  private retryRecords: Map<string, RetryRecord> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    projectId: string,
    endpoint: string,
    deviceInfo: DeviceInfo,
    sdkVersion: string,
    config?: Partial<BatchConfig>
  ) {
    this.projectId = projectId;
    this.endpoint = endpoint;
    this.deviceInfo = deviceInfo;
    this.sdkVersion = sdkVersion;
    this.storageKey = `analytics_events_${projectId}`;

    // 合并配置
    this.batchConfig = {
      maxBatchSize: 50,
      flushInterval: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableOfflineStorage: true,
      maxStorageSize: 1024 * 1024, // 1MB
      ...config,
    };

    // 初始化当前批量大小
    this.currentBatchSize = this.batchConfig.adaptive?.enabled
      ? (this.batchConfig.adaptive.initialBatchSize || this.batchConfig.maxBatchSize)
      : this.batchConfig.maxBatchSize;

    this.initBatchMechanism();
    this.loadOfflineEvents();
  }

  /**
   * 设置用户ID
   */
  setUser(uid: string): void {
    this.uid = uid;
  }

  /**
   * 添加事件到队列
   */
  addEvent(event: UnifiedEvent, priority: EventPriority = 'normal'): void {
    const queuedEvent: QueuedEvent = {
      id: generateUUID(),
      event,
      timestamp: Date.now(),
      retryCount: 0,
      priority,
    };

    // 按优先级插入
    if (priority === 'high') {
      this.eventQueue.unshift(queuedEvent);
    } else if (priority === 'low') {
      this.eventQueue.push(queuedEvent);
    } else {
      // normal优先级：插入到高优先级之后
      const firstLowIndex = this.eventQueue.findIndex(e => e.priority === 'low');
      if (firstLowIndex === -1) {
        this.eventQueue.push(queuedEvent);
      } else {
        this.eventQueue.splice(firstLowIndex, 0, queuedEvent);
      }
    }

    console.log(`[SDK Transport] 事件已添加到队列: ${event.eventType}, 当前队列长度: ${this.eventQueue.length}`);

    // 如果队列达到批量大小，立即刷新
    const batchSize = this.batchConfig.adaptive?.enabled
      ? this.currentBatchSize
      : this.batchConfig.maxBatchSize;

    if (this.eventQueue.length >= batchSize) {
      console.log(`[SDK Transport] 队列达到批量大小(${batchSize})，立即刷新`);
      this.flush();
    }
  }

  /**
   * 刷新队列（发送批量事件）
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      console.log('[SDK Transport] 队列为空，无需刷新');
      return;
    }

    console.log(`[SDK Transport] 开始刷新队列，当前队列长度: ${this.eventQueue.length}`);

    // 如果离线且启用离线存储，保存到本地
    if (!this.isOnline && this.batchConfig.enableOfflineStorage) {
      console.log('[SDK Transport] 当前离线，保存到本地存储');
      this.saveToOfflineStorage();
      return;
    }

    // 确定批量大小
    const batchSize = this.batchConfig.adaptive?.enabled
      ? this.currentBatchSize
      : this.batchConfig.maxBatchSize;

    // 准备批量发送的数据
    const eventsToSend = this.eventQueue.splice(0, batchSize);
    const sendStartTime = performance.now();

    console.log(`[SDK Transport] 准备发送 ${eventsToSend.length} 个事件到 ${this.endpoint}`);

    try {
      const response = await this.sendBatch(eventsToSend);
      const sendDuration = performance.now() - sendStartTime;

      if (response.success) {
        console.log(`[SDK Transport] 批量发送成功，处理了 ${response.processedCount} 个事件，耗时 ${sendDuration.toFixed(2)}ms`);
        this.recordSendResult(true, sendDuration, eventsToSend.length);

        // 处理失败的事件
        if (response.failedEvents && response.failedEvents.length > 0) {
          console.warn(`[SDK Transport] ${response.failedEvents.length} 个事件发送失败`);
          this.handleFailedEvents(response.failedEvents);
        }
      } else {
        // 发送失败，重新加入队列
        console.error('[SDK Transport] 批量发送失败');
        this.eventQueue.unshift(...eventsToSend);
        this.handleFailedEvents(eventsToSend, new Error('发送失败'));
        this.recordSendResult(false, sendDuration, eventsToSend.length);
      }
    } catch (error: any) {
      const sendDuration = performance.now() - sendStartTime;
      console.error(`[SDK Transport] 批量发送异常:`, error);
      // 发送失败，重新加入队列
      this.eventQueue.unshift(...eventsToSend);
      this.handleFailedEvents(eventsToSend, error as Error);
      this.recordSendResult(false, sendDuration, eventsToSend.length);
    }
  }

  /**
   * 使用Beacon API发送
   */
  sendWithBeacon(events: UnifiedEvent[]): boolean {
    if (!this.beaconSupported) {
      return false;
    }

    const batchData = {
      projectId: this.projectId,
      events,
      batchSize: events.length,
      timestamp: Date.now(),
      uid: this.uid,
      deviceInfo: this.deviceInfo,
      sdkVersion: this.sdkVersion,
    };

    const data = JSON.stringify(batchData);
    const blob = new Blob([data], { type: 'application/json' });
    return navigator.sendBeacon(this.endpoint, blob);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      queueLength: this.eventQueue.length,
      isOnline: this.isOnline,
      currentBatchSize: this.currentBatchSize,
    };
  }

  /**
   * 销毁传输管道
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
      this.networkCheckTimer = null;
    }
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }
    // 清理所有重试定时器
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
  }

  // ========== 私有方法 ==========

  /**
   * 初始化批量机制
   */
  private initBatchMechanism(): void {
    // 监听网络状态
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // 页面卸载时使用 Beacon API
    window.addEventListener('beforeunload', () => {
      this.flushQueueWithBeacon();
    });

    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) {
        this.flushQueueWithBeacon();
      }
    });

    // 启动定时刷新
    this.startFlushTimer();
  }

  /**
   * 启动刷新定时器
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, this.batchConfig.flushInterval);
  }

  /**
   * 使用Beacon刷新队列
   */
  private flushQueueWithBeacon(): void {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.map(qe => qe.event);
    const success = this.sendWithBeacon(events);

    if (success) {
      this.eventQueue = [];
    } else if (this.batchConfig.enableOfflineStorage) {
      this.saveToOfflineStorage();
    }
  }

  /**
   * 发送批量事件
   */
  private async sendBatch(events: QueuedEvent[]): Promise<BatchResponse> {
    const batchData = {
      projectId: this.projectId,
      events: events.map(event => event.event),
      batchSize: events.length,
      timestamp: Date.now(),
      uid: this.uid,
      deviceInfo: this.deviceInfo,
      sdkVersion: this.sdkVersion,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[SDK Transport] HTTP错误 ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 尝试解析响应，如果失败也不影响成功状态
      try {
        await response.json();
      } catch (e) {
        // 响应不是JSON格式，忽略
        console.log('[SDK Transport] 响应不是JSON格式，已忽略');
      }

      return {
        success: true,
        processedCount: events.length,
        failedEvents: [],
      };
    } catch (error: any) {
      console.error('[SDK Transport] 发送批量事件失败:', error);
      throw error;
    }
  }

  /**
   * 处理失败的事件
   */
  private handleFailedEvents(failedEvents: QueuedEvent[], error?: Error): void {
    const errorType = this.classifyError(error);

    failedEvents.forEach(event => {
      event.retryCount++;

      if (event.retryCount < this.batchConfig.maxRetries) {
        const backoffDelay = this.calculateBackoffDelay(event.retryCount, errorType);

        const retryRecord: RetryRecord = {
          eventId: event.id,
          retryCount: event.retryCount,
          lastRetryTime: Date.now(),
          nextRetryTime: Date.now() + backoffDelay,
          backoffDelay,
          errorType,
        };
        this.retryRecords.set(event.id, retryRecord);

        // 清除之前的定时器
        const existingTimer = this.retryTimers.get(event.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // 设置新的重试定时器
        const timer = setTimeout(() => {
          this.retryTimers.delete(event.id);
          this.eventQueue.push(event);
        }, backoffDelay);

        this.retryTimers.set(event.id, timer);
      } else {
        // 超过最大重试次数，保存到离线存储
        this.retryRecords.delete(event.id);
        const existingTimer = this.retryTimers.get(event.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.retryTimers.delete(event.id);
        }
        if (this.batchConfig.enableOfflineStorage) {
          this.saveEventToOfflineStorage(event);
        }
      }
    });
  }

  /**
   * 分类错误类型
   */
  private classifyError(error?: Error): ErrorType {
    if (!error) return 'unknown';

    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('network') || msg.includes('fetch')) return 'network';
    if (msg.includes('timeout') || msg.includes('aborted')) return 'timeout';
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'server';
    if (msg.includes('400') || msg.includes('401') || msg.includes('403')) return 'client';
    return 'unknown';
  }

  /**
   * 计算指数退避延迟
   */
  private calculateBackoffDelay(retryCount: number, errorType: ErrorType): number {
    const backoffConfig = this.batchConfig.exponentialBackoff;
    if (!backoffConfig?.enabled) {
      return this.batchConfig.retryDelay * retryCount;
    }

    let delay = backoffConfig.baseDelay * Math.pow(backoffConfig.multiplier, retryCount - 1);
    
    // 应用抖动
    if (backoffConfig.jitterEnabled) {
      const jitter = delay * backoffConfig.jitterRatio * (Math.random() * 2 - 1);
      delay = delay + jitter;
    }

    // 限制最大延迟
    delay = Math.min(delay, backoffConfig.maxDelay);

    return Math.max(0, delay);
  }

  /**
   * 记录发送结果
   */
  private recordSendResult(success: boolean, duration: number, batchSize: number): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    this.recentSendResults.push({ success, duration, batchSize });
    if (this.recentSendResults.length > 20) {
      this.recentSendResults.shift();
    }
  }

  /**
   * 保存到离线存储
   */
  private saveToOfflineStorage(): void {
    if (this.eventQueue.length === 0) return;

    try {
      const existing = localStorage.getItem(this.storageKey);
      const events = existing ? JSON.parse(existing) : [];
      events.push(...this.eventQueue.map(qe => qe.event));

      // 限制存储大小
      const dataStr = JSON.stringify(events);
      if (dataStr.length > this.batchConfig.maxStorageSize) {
        // 删除最旧的事件
        const excess = dataStr.length - this.batchConfig.maxStorageSize;
        events.splice(0, Math.ceil(excess / 100));
      }

      localStorage.setItem(this.storageKey, JSON.stringify(events));
      this.eventQueue = [];
    } catch (error) {
      console.error('保存离线事件失败:', error);
    }
  }

  /**
   * 保存单个事件到离线存储
   */
  private saveEventToOfflineStorage(event: QueuedEvent): void {
    try {
      const existing = localStorage.getItem(this.storageKey);
      const events = existing ? JSON.parse(existing) : [];
      events.push(event.event);

      const dataStr = JSON.stringify(events);
      if (dataStr.length > this.batchConfig.maxStorageSize) {
        events.shift();
      }

      localStorage.setItem(this.storageKey, JSON.stringify(events));
    } catch (error) {
      console.error('保存离线事件失败:', error);
    }
  }

  /**
   * 加载离线事件
   */
  private loadOfflineEvents(): void {
    if (!this.batchConfig.enableOfflineStorage) return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return;

      const events: UnifiedEvent[] = JSON.parse(data);
      events.forEach(event => {
        const queuedEvent: QueuedEvent = {
          id: generateUUID(),
          event,
          timestamp: Date.now(),
          retryCount: 0,
          priority: 'normal',
        };
        this.eventQueue.push(queuedEvent);
      });

      localStorage.removeItem(this.storageKey);

      // 网络在线时立即发送
      if (this.isOnline && events.length > 0) {
        this.flush();
      }
    } catch (error) {
      console.error('加载离线事件失败:', error);
    }
  }
}

