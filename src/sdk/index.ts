import { v4 as uuidv4 } from 'uuid';

interface TrackEvent {
  eventName: string;
  eventParams?: Record<string, any>;
  timestamp: number;
}

interface CommonParams {
  uid?: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
  sdkVersion: string;
}

// 批量发送配置接口
interface BatchConfig {
  maxBatchSize: number;        // 最大批量大小
  flushInterval: number;        // 刷新间隔（毫秒）
  maxRetries: number;          // 最大重试次数
  retryDelay: number;          // 重试延迟（毫秒）
  enableOfflineStorage: boolean; // 是否启用离线存储
  maxStorageSize: number;      // 最大存储大小（字节）
}

// 事件队列项接口
interface QueuedEvent {
  id: string;
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
}

// 批量发送响应接口
interface BatchResponse {
  success: boolean;
  processedCount: number;
  failedEvents?: QueuedEvent[];
}

class AnalyticsSDK {
  private static instances: Map<string, AnalyticsSDK> = new Map();
  private commonParams: CommonParams;
  private endpoint: string;
  private projectId: string;
  
  // 批量发送相关属性
  private eventQueue: QueuedEvent[] = [];
  private batchConfig: BatchConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private storageKey: string;

  private constructor(projectId: string, endpoint: string, config?: Partial<BatchConfig>) {
    this.projectId = projectId;
    this.endpoint = endpoint;
    this.storageKey = `analytics_events_${projectId}`;
    
    // 默认批量配置
    this.batchConfig = {
      maxBatchSize: 50,           // 最大批量50个事件
      flushInterval: 5000,         // 5秒刷新一次
      maxRetries: 3,              // 最大重试3次
      retryDelay: 1000,           // 重试延迟1秒
      enableOfflineStorage: true, // 启用离线存储
      maxStorageSize: 1024 * 1024, // 最大存储1MB
      ...config
    };

    this.commonParams = {
      deviceInfo: this.getDeviceInfo(),
      sdkVersion: '1.0.0'
    };

    this.initErrorCapture();
    this.initBatchMechanism();
    this.loadOfflineEvents();
  }

  public static getInstance(projectId: string, endpoint: string, config?: Partial<BatchConfig>): AnalyticsSDK {
    const key = `${projectId}-${endpoint}`;
    if (!AnalyticsSDK.instances.has(key)) {
      AnalyticsSDK.instances.set(key, new AnalyticsSDK(projectId, endpoint, config));
    }
    return AnalyticsSDK.instances.get(key)!;
  }

  // 清理指定项目的SDK实例
  public static clearInstance(projectId: string, endpoint: string): void {
    const key = `${projectId}-${endpoint}`;
    AnalyticsSDK.instances.delete(key);
  }

  // 清理所有SDK实例
  public static clearAllInstances(): void {
    AnalyticsSDK.instances.clear();
  }

  // 获取当前实例的项目ID
  public getProjectId(): string {
    return this.projectId;
  }

  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  public setUser(uid: string) {
    this.commonParams.uid = uid;
  }

  // 初始化批量发送机制
  private initBatchMechanism(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('网络已连接，开始发送离线事件');
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('网络已断开，事件将存储到本地');
    });

    // 页面卸载时发送剩余事件
    window.addEventListener('beforeunload', () => {
      this.flushQueue(true);
    });

    // 页面隐藏时发送事件（移动端）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushQueue();
      }
    });

    // 启动定时刷新
    this.startFlushTimer();
  }

  // 启动定时刷新器
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushQueue();
      }
    }, this.batchConfig.flushInterval);
  }

  // 停止定时刷新器
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // 添加事件到队列
  private addToQueue(data: any, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const queuedEvent: QueuedEvent = {
      id: uuidv4(),
      data,
      timestamp: Date.now(),
      retryCount: 0,
      priority
    };

    // 根据优先级插入队列
    if (priority === 'high') {
      this.eventQueue.unshift(queuedEvent);
    } else {
      this.eventQueue.push(queuedEvent);
    }

    console.log(`事件已添加到队列，当前队列长度: ${this.eventQueue.length}`);

    // 如果达到批量大小限制，立即发送
    if (this.eventQueue.length >= this.batchConfig.maxBatchSize) {
      this.flushQueue();
    }
  }

  // 刷新队列（发送批量事件）
  private async flushQueue(force: boolean = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    // 如果离线且启用离线存储，保存到本地
    if (!this.isOnline && this.batchConfig.enableOfflineStorage) {
      this.saveToOfflineStorage();
      return;
    }

    // 准备批量发送的数据
    const eventsToSend = this.eventQueue.splice(0, this.batchConfig.maxBatchSize);
    
    try {
      const response = await this.sendBatch(eventsToSend);
      
      if (response.success) {
        console.log(`批量发送成功，处理了 ${response.processedCount} 个事件`);
        
        // 处理失败的事件
        if (response.failedEvents && response.failedEvents.length > 0) {
          this.handleFailedEvents(response.failedEvents);
        }
      } else {
        // 发送失败，重新加入队列
        this.eventQueue.unshift(...eventsToSend);
        this.handleFailedEvents(eventsToSend);
      }
    } catch (error) {
      console.error('批量发送失败:', error);
      // 发送失败，重新加入队列
      this.eventQueue.unshift(...eventsToSend);
      this.handleFailedEvents(eventsToSend);
    }
  }

  // 发送批量事件
  private async sendBatch(events: QueuedEvent[]): Promise<BatchResponse> {
    const batchData = {
      projectId: this.projectId,
      events: events.map(event => event.data),
      batchSize: events.length,
      timestamp: Date.now(),
      ...this.commonParams
    };

    console.log(`发送批量事件，数量: ${events.length}`);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      processedCount: events.length,
      failedEvents: []
    };
  }

  // 处理失败的事件
  private handleFailedEvents(failedEvents: QueuedEvent[]): void {
    failedEvents.forEach(event => {
      event.retryCount++;
      
      if (event.retryCount < this.batchConfig.maxRetries) {
        // 延迟重试
        setTimeout(() => {
          this.eventQueue.push(event);
        }, this.batchConfig.retryDelay * event.retryCount);
      } else {
        // 超过最大重试次数，保存到离线存储
        console.warn(`事件 ${event.id} 重试次数超限，保存到离线存储`);
        if (this.batchConfig.enableOfflineStorage) {
          this.saveEventToOfflineStorage(event);
        }
      }
    });
  }

  // 保存到离线存储
  private saveToOfflineStorage(): void {
    if (!this.batchConfig.enableOfflineStorage) return;

    try {
      const existingEvents = this.getOfflineEvents();
      const allEvents = [...existingEvents, ...this.eventQueue];
      
      // 检查存储大小限制
      const eventsToStore = this.limitStorageSize(allEvents);
      
      localStorage.setItem(this.storageKey, JSON.stringify(eventsToStore));
      console.log(`已保存 ${eventsToStore.length} 个事件到离线存储`);
      
      // 清空队列
      this.eventQueue = [];
    } catch (error) {
      console.error('保存到离线存储失败:', error);
    }
  }

  // 保存单个事件到离线存储
  private saveEventToOfflineStorage(event: QueuedEvent): void {
    try {
      const existingEvents = this.getOfflineEvents();
      const allEvents = [...existingEvents, event];
      const eventsToStore = this.limitStorageSize(allEvents);
      
      localStorage.setItem(this.storageKey, JSON.stringify(eventsToStore));
    } catch (error) {
      console.error('保存事件到离线存储失败:', error);
    }
  }

  // 加载离线事件
  private loadOfflineEvents(): void {
    if (!this.batchConfig.enableOfflineStorage) return;

    try {
      const offlineEvents = this.getOfflineEvents();
      if (offlineEvents.length > 0) {
        this.eventQueue.push(...offlineEvents);
        console.log(`加载了 ${offlineEvents.length} 个离线事件`);
        
        // 清空离线存储
        localStorage.removeItem(this.storageKey);
        
        // 如果在线，立即尝试发送
        if (this.isOnline) {
          this.flushQueue();
        }
      }
    } catch (error) {
      console.error('加载离线事件失败:', error);
    }
  }

  // 获取离线事件
  private getOfflineEvents(): QueuedEvent[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取离线事件失败:', error);
      return [];
    }
  }

  // 限制存储大小
  private limitStorageSize(events: QueuedEvent[]): QueuedEvent[] {
    const maxEvents = Math.floor(this.batchConfig.maxStorageSize / 1000); // 粗略估算
    return events.slice(-maxEvents);
  }

  // 手动刷新队列（公开方法）
  public flush(): Promise<void> {
    return this.flushQueue(true);
  }

  // 获取队列状态（公开方法）
  public getQueueStatus(): { queueLength: number; isOnline: boolean; config: BatchConfig } {
    return {
      queueLength: this.eventQueue.length,
      isOnline: this.isOnline,
      config: this.batchConfig
    };
  }

  // 更新批量配置（公开方法）
  public updateBatchConfig(newConfig: Partial<BatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...newConfig };
    
    // 重启定时器
    this.stopFlushTimer();
    this.startFlushTimer();
  }

  public track(eventName: string, eventParams?: Record<string, any>, priority: 'high' | 'normal' | 'low' = 'normal') {
    const event: TrackEvent = {
      eventName,
      eventParams,
      timestamp: Date.now(),
    };

    const eventData = {
      ...event,
      projectId: this.projectId,
      ...this.commonParams,
    };

    // 使用批量发送机制
    this.addToQueue(eventData, priority);
  }

  // 专门用于错误事件的方法
  public trackError(errorType: string, errorDetails: Record<string, any>) {
    this.track('error', {
      错误类型: errorType,
      ...errorDetails,
      发生时间: new Date().toISOString()
    }, 'high'); // 错误事件使用高优先级
  }

  // 专门用于用户行为事件的方法
  public trackUserAction(action: string, actionDetails: Record<string, any>) {
    this.track('userAction', {
      用户行为: action,
      ...actionDetails,
      行为时间: new Date().toISOString()
    }, 'normal'); // 用户行为使用普通优先级
  }



  private initErrorCapture() {
    window.addEventListener('error', (event) => {
      this.track('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      }, 'high'); // 错误事件使用高优先级
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('unhandledRejection', {
        reason: event.reason,
      }, 'high'); // 未处理的Promise拒绝使用高优先级
    });
  }
}

export default AnalyticsSDK; 