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

// 网络状况接口
interface NetworkMetrics {
  rtt: number;                 // 往返时延（毫秒）
  bandwidth: number;            // 带宽估算（字节/秒）
  connectionType: string;      // 连接类型（4g, 3g, wifi等）
  quality: 'excellent' | 'good' | 'fair' | 'poor'; // 网络质量评级
  lastUpdate: number;          // 最后更新时间
}

// 网络状况历史记录
interface NetworkHistory {
  metrics: NetworkMetrics[];
  successRate: number;         // 发送成功率
  avgResponseTime: number;     // 平均响应时间
  lastFailureTime?: number;    // 最后失败时间
}

// 自适应批量大小配置
interface AdaptiveBatchConfig {
  enabled: boolean;             // 是否启用自适应批量大小
  minBatchSize: number;        // 最小批量大小（默认10）
  maxBatchSize: number;         // 最大批量大小（默认100）
  initialBatchSize: number;      // 初始批量大小（默认50）
  queueLengthWeight: number;    // 队列长度权重（0-1，默认0.3）
  networkQualityWeight: number; // 网络质量权重（0-1，默认0.7）
  adjustmentInterval: number;   // 调整间隔（毫秒，默认30000）
  networkCheckInterval: number; // 网络检查间隔（毫秒，默认10000）
}

// 指数退避配置接口
interface ExponentialBackoffConfig {
  enabled: boolean;            // 是否启用指数退避（默认true）
  baseDelay: number;           // 基础延迟（毫秒，默认1000）
  maxDelay: number;            // 最大延迟（毫秒，默认30000）
  multiplier: number;          // 指数乘数（默认2）
  jitterEnabled: boolean;      // 是否启用抖动（默认true）
  jitterRatio: number;         // 抖动比例 0-1（默认0.1，即±10%）
  networkAware: boolean;       // 是否根据网络状况调整（默认true）
  errorTypeAware: boolean;    // 是否根据错误类型调整（默认true）
}

// 错误类型枚举
type ErrorType = 'network' | 'timeout' | 'server' | 'client' | 'unknown';

// 重试记录接口
interface RetryRecord {
  eventId: string;
  retryCount: number;
  lastRetryTime: number;
  nextRetryTime: number;
  backoffDelay: number;
  errorType: ErrorType;
  errorMessage?: string;
}

// 批量发送配置接口
interface BatchConfig {
  maxBatchSize: number;        // 最大批量大小（如果启用自适应，作为上限）
  flushInterval: number;        // 刷新间隔（毫秒）
  maxRetries: number;          // 最大重试次数
  retryDelay: number;          // 重试延迟（毫秒，已废弃，使用exponentialBackoff.baseDelay）
  enableOfflineStorage: boolean; // 是否启用离线存储
  maxStorageSize: number;      // 最大存储大小（字节）
  adaptive?: AdaptiveBatchConfig; // 自适应批量大小配置
  exponentialBackoff?: ExponentialBackoffConfig; // 指数退避配置
}

// 白屏检测配置接口
interface BlankScreenConfig {
  enabled: boolean;            // 是否启用白屏检测
  checkInterval: number;        // 检测间隔（毫秒），默认3000
  rootSelector: string;         // 根元素选择器，默认'#root'
  threshold: number;            // 白屏判定阈值（毫秒），默认5000
  checkElements: string[];      // 需要检查的关键元素选择器
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
  
  // 自适应批量大小相关属性
  private currentBatchSize: number;
  private networkMetrics: NetworkMetrics | null = null;
  private networkHistory: NetworkHistory = {
    metrics: [],
    successRate: 1.0,
    avgResponseTime: 0
  };
  private networkCheckTimer: NodeJS.Timeout | null = null;
  private adjustmentTimer: NodeJS.Timeout | null = null;
  private recentSendResults: Array<{ success: boolean; duration: number; batchSize: number }> = [];
  
  // 指数退避相关属性
  private retryRecords: Map<string, RetryRecord> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // 白屏检测相关属性
  private blankScreenConfig: BlankScreenConfig;
  private blankScreenCheckTimer: NodeJS.Timeout | null = null;
  private blankScreenObserver: MutationObserver | null = null;
  private lastContentCheckTime: number = Date.now();
  private blankScreenReported: boolean = false;

  private constructor(projectId: string, endpoint: string, config?: Partial<BatchConfig>, blankScreenConfig?: Partial<BlankScreenConfig>) {
    this.projectId = projectId;
    this.endpoint = endpoint;
    this.storageKey = `analytics_events_${projectId}`;
    
    // 默认批量配置
    this.batchConfig = {
      maxBatchSize: 50,           // 最大批量50个事件
      flushInterval: 5000,         // 5秒刷新一次
      maxRetries: 3,              // 最大重试3次
      retryDelay: 1000,           // 重试延迟1秒（向后兼容）
      enableOfflineStorage: true, // 启用离线存储
      maxStorageSize: 1024 * 1024, // 最大存储1MB
      adaptive: {
        enabled: true,            // 默认启用自适应
        minBatchSize: 10,         // 最小批量10个
        maxBatchSize: 100,        // 最大批量100个
        initialBatchSize: 50,     // 初始批量50个
        queueLengthWeight: 0.3,   // 队列长度权重30%
        networkQualityWeight: 0.7, // 网络质量权重70%
        adjustmentInterval: 30000, // 30秒调整一次
        networkCheckInterval: 10000, // 10秒检查一次网络
        ...config?.adaptive
      },
      exponentialBackoff: {
        enabled: true,            // 默认启用指数退避
        baseDelay: 1000,          // 基础延迟1秒
        maxDelay: 30000,          // 最大延迟30秒
        multiplier: 2,            // 指数乘数2（2^n）
        jitterEnabled: true,      // 启用抖动
        jitterRatio: 0.1,         // 抖动比例10%
        networkAware: true,       // 根据网络状况调整
        errorTypeAware: true,     // 根据错误类型调整
        ...config?.exponentialBackoff
      },
      ...config
    };

    // 初始化当前批量大小
    this.currentBatchSize = this.batchConfig.adaptive?.enabled 
      ? (this.batchConfig.adaptive.initialBatchSize || this.batchConfig.maxBatchSize)
      : this.batchConfig.maxBatchSize;

    // 默认白屏检测配置
    this.blankScreenConfig = {
      enabled: true,              // 默认启用
      checkInterval: 3000,        // 每3秒检测一次
      rootSelector: '#root',      // 默认根元素
      threshold: 5000,            // 5秒无内容判定为白屏
      checkElements: ['#root', 'body'], // 默认检查的元素
      ...blankScreenConfig
    };

    this.commonParams = {
      deviceInfo: this.getDeviceInfo(),
      sdkVersion: '1.0.0'
    };

    this.initErrorCapture();
    this.initBatchMechanism();
    this.initBlankScreenDetection();
    this.loadOfflineEvents();
    
    // 初始化自适应批量大小机制
    if (this.batchConfig.adaptive?.enabled) {
      this.initAdaptiveBatchSize();
    }
  }

  public static getInstance(projectId: string, endpoint: string, config?: Partial<BatchConfig>, blankScreenConfig?: Partial<BlankScreenConfig>): AnalyticsSDK {
    const key = `${projectId}-${endpoint}`;
    if (!AnalyticsSDK.instances.has(key)) {
      AnalyticsSDK.instances.set(key, new AnalyticsSDK(projectId, endpoint, config, blankScreenConfig));
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
      // 网络恢复时立即检测网络状况
      if (this.batchConfig.adaptive?.enabled) {
        this.checkNetworkStatus();
      }
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('网络已断开，事件将存储到本地');
      // 网络断开时重置网络指标
      if (this.networkMetrics) {
        this.networkMetrics.quality = 'poor';
      }
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

  // 初始化自适应批量大小机制
  private initAdaptiveBatchSize(): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    // 初始网络检测
    this.checkNetworkStatus();

    // 启动网络状况定期检查
    this.startNetworkCheckTimer();

    // 启动批量大小调整定时器
    this.startAdjustmentTimer();
  }

  // 启动网络检查定时器
  private startNetworkCheckTimer(): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
    }

    const interval = this.batchConfig.adaptive.networkCheckInterval;
    this.networkCheckTimer = setInterval(() => {
      this.checkNetworkStatus();
    }, interval);
  }

  // 启动批量大小调整定时器
  private startAdjustmentTimer(): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
    }

    const interval = this.batchConfig.adaptive.adjustmentInterval;
    this.adjustmentTimer = setInterval(() => {
      this.adjustBatchSize();
    }, interval);
  }

  // 停止网络检查定时器
  private stopNetworkCheckTimer(): void {
    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
      this.networkCheckTimer = null;
    }
  }

  // 停止批量大小调整定时器
  private stopAdjustmentTimer(): void {
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }
  }

  // 检测网络状况
  private async checkNetworkStatus(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    try {
      const startTime = performance.now();
      
      // 使用轻量级请求检测网络延迟
      // 尝试使用 OPTIONS 请求（CORS预检），如果失败则使用小数据包测试
      try {
        await fetch(this.endpoint, {
          method: 'OPTIONS',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000) // 5秒超时
        });
      } catch (optionsError) {
        // OPTIONS 失败，使用小数据包测试
        const testData = { test: true, timestamp: Date.now() };
        await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData),
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
      }

      const endTime = performance.now();
      const rtt = endTime - startTime;

      // 获取连接类型（如果支持）
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      let connectionType = 'unknown';
      let bandwidth = 0;

      if (connection) {
        connectionType = connection.effectiveType || connectionType;
        // downlink 单位是 Mbps，转换为字节/秒
        bandwidth = connection.downlink ? connection.downlink * 1024 * 1024 / 8 : 0;
      }

      // 如果没有连接信息，根据 RTT 估算带宽
      if (bandwidth === 0) {
        if (rtt < 50) {
          bandwidth = 10 * 1024 * 1024; // 假设高速网络
        } else if (rtt < 200) {
          bandwidth = 5 * 1024 * 1024; // 假设中速网络
        } else if (rtt < 500) {
          bandwidth = 1 * 1024 * 1024; // 假设低速网络
        } else {
          bandwidth = 100 * 1024; // 假设很慢的网络
        }
      }

      // 评估网络质量
      const quality = this.evaluateNetworkQuality(rtt, bandwidth);

      this.networkMetrics = {
        rtt,
        bandwidth,
        connectionType,
        quality,
        lastUpdate: Date.now()
      };

      // 更新历史记录
      this.updateNetworkHistory(this.networkMetrics);

      console.log(`网络状况检测: RTT=${rtt.toFixed(2)}ms, 质量=${quality}, 类型=${connectionType}, 带宽=${(bandwidth / 1024 / 1024).toFixed(2)}Mbps`);
    } catch (error) {
      console.warn('网络状况检测失败:', error);
      // 检测失败时，使用保守的网络质量评估
      if (!this.networkMetrics) {
        this.networkMetrics = {
          rtt: 1000,
          bandwidth: 100 * 1024, // 100KB/s
          connectionType: 'unknown',
          quality: 'poor',
          lastUpdate: Date.now()
        };
      } else {
        // 基于上次的 RTT 增加，表示网络变差
        this.networkMetrics.rtt = Math.min(this.networkMetrics.rtt * 1.5, 5000);
        this.networkMetrics.quality = 'poor';
        this.networkMetrics.lastUpdate = Date.now();
      }
    }
  }

  // 评估网络质量
  private evaluateNetworkQuality(rtt: number, bandwidth: number): 'excellent' | 'good' | 'fair' | 'poor' {
    // 基于RTT和带宽评估网络质量
    if (rtt < 50 && bandwidth > 5 * 1024 * 1024) {
      return 'excellent';
    } else if (rtt < 100 && bandwidth > 1 * 1024 * 1024) {
      return 'good';
    } else if (rtt < 300 && bandwidth > 100 * 1024) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  // 更新网络历史记录
  private updateNetworkHistory(metrics: NetworkMetrics): void {
    this.networkHistory.metrics.push(metrics);
    
    // 只保留最近50条记录
    if (this.networkHistory.metrics.length > 50) {
      this.networkHistory.metrics.shift();
    }

    // 计算平均RTT
    const avgRtt = this.networkHistory.metrics.reduce((sum, m) => sum + m.rtt, 0) / this.networkHistory.metrics.length;
    this.networkHistory.avgResponseTime = avgRtt;
  }

  // 根据网络状况和队列长度调整批量大小
  private adjustBatchSize(): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    const config = this.batchConfig.adaptive;
    const queueLength = this.eventQueue.length;

    // 基于网络质量的批量大小调整
    let networkBasedSize = config.initialBatchSize;
    if (this.networkMetrics) {
      const qualityMultiplier = {
        excellent: 1.5,
        good: 1.2,
        fair: 0.8,
        poor: 0.5
      };
      networkBasedSize = Math.round(config.initialBatchSize * qualityMultiplier[this.networkMetrics.quality]);
    }

    // 基于队列长度的批量大小调整
    let queueBasedSize = config.initialBatchSize;
    if (queueLength > 100) {
      // 队列很长，增加批量大小以快速清空
      queueBasedSize = Math.min(config.maxBatchSize, Math.round(queueLength * 0.3));
    } else if (queueLength < 20) {
      // 队列很短，减少批量大小以降低延迟
      queueBasedSize = Math.max(config.minBatchSize, Math.round(queueLength * 0.5));
    }

    // 基于发送成功率的调整
    if (this.recentSendResults.length > 0) {
      const successRate = this.recentSendResults.filter(r => r.success).length / this.recentSendResults.length;
      const avgDuration = this.recentSendResults.reduce((sum, r) => sum + r.duration, 0) / this.recentSendResults.length;

      // 如果成功率低或响应时间长，减少批量大小
      if (successRate < 0.8 || avgDuration > 2000) {
        networkBasedSize = Math.round(networkBasedSize * 0.7);
      } else if (successRate > 0.95 && avgDuration < 500) {
        // 如果成功率高且响应快，可以适当增加
        networkBasedSize = Math.round(networkBasedSize * 1.1);
      }
    }

    // 加权合并网络质量和队列长度的影响
    const newBatchSize = Math.round(
      networkBasedSize * config.networkQualityWeight + 
      queueBasedSize * config.queueLengthWeight
    );

    // 限制在最小和最大范围内
    const adjustedSize = Math.max(
      config.minBatchSize,
      Math.min(config.maxBatchSize, newBatchSize)
    );

    // 平滑调整，避免剧烈变化
    const changeRatio = adjustedSize / this.currentBatchSize;
    if (changeRatio > 1.5 || changeRatio < 0.67) {
      // 变化超过50%，平滑调整
      this.currentBatchSize = Math.round(this.currentBatchSize * (1 + (changeRatio - 1) * 0.3));
    } else {
      this.currentBatchSize = adjustedSize;
    }

    // 确保在范围内
    this.currentBatchSize = Math.max(
      config.minBatchSize,
      Math.min(config.maxBatchSize, this.currentBatchSize)
    );

    console.log(`批量大小调整: ${this.currentBatchSize} (队列: ${queueLength}, 网络质量: ${this.networkMetrics?.quality || 'unknown'})`);
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
    const batchSize = this.batchConfig.adaptive?.enabled 
      ? this.currentBatchSize 
      : this.batchConfig.maxBatchSize;
    
    if (this.eventQueue.length >= batchSize) {
      this.flushQueue();
    }
  }

  // 刷新队列（发送批量事件）
  private async flushQueue(_force: boolean = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    // 如果离线且启用离线存储，保存到本地
    if (!this.isOnline && this.batchConfig.enableOfflineStorage) {
      this.saveToOfflineStorage();
      return;
    }

    // 确定批量大小（使用自适应或固定值）
    const batchSize = this.batchConfig.adaptive?.enabled 
      ? this.currentBatchSize 
      : this.batchConfig.maxBatchSize;

    // 准备批量发送的数据
    const eventsToSend = this.eventQueue.splice(0, batchSize);
    const sendStartTime = performance.now();
    
    try {
      const response = await this.sendBatch(eventsToSend);
      const sendDuration = performance.now() - sendStartTime;
      
      if (response.success) {
        console.log(`批量发送成功，处理了 ${response.processedCount} 个事件，耗时 ${sendDuration.toFixed(2)}ms`);
        
        // 记录发送结果（用于自适应调整）
        this.recordSendResult(true, sendDuration, eventsToSend.length);
        
        // 处理失败的事件
        if (response.failedEvents && response.failedEvents.length > 0) {
          this.handleFailedEvents(response.failedEvents);
        }
      } else {
        // 发送失败，重新加入队列
        this.eventQueue.unshift(...eventsToSend);
        this.handleFailedEvents(eventsToSend, new Error('发送失败'));
        this.recordSendResult(false, sendDuration, eventsToSend.length);
      }
    } catch (error) {
      const sendDuration = performance.now() - sendStartTime;
      console.error('批量发送失败:', error);
      // 发送失败，重新加入队列
      this.eventQueue.unshift(...eventsToSend);
      this.handleFailedEvents(eventsToSend, error as Error);
      this.recordSendResult(false, sendDuration, eventsToSend.length);
    }
  }

  // 记录发送结果（用于自适应调整）
  private recordSendResult(success: boolean, duration: number, batchSize: number): void {
    if (!this.batchConfig.adaptive?.enabled) return;

    this.recentSendResults.push({ success, duration, batchSize });
    
    // 只保留最近20条记录
    if (this.recentSendResults.length > 20) {
      this.recentSendResults.shift();
    }

    // 更新网络历史成功率
    const successCount = this.recentSendResults.filter(r => r.success).length;
    this.networkHistory.successRate = successCount / this.recentSendResults.length;

    // 如果连续失败，立即触发调整
    const recentFailures = this.recentSendResults.slice(-3).filter(r => !r.success).length;
    if (recentFailures >= 3) {
      this.networkHistory.lastFailureTime = Date.now();
      // 立即调整批量大小
      this.adjustBatchSize();
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

    try {
      // 使用 AbortController 支持超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        let error: Error;
        
        // 根据状态码创建更具体的错误
        if (statusCode >= 500) {
          error = new Error(`Server error: ${statusCode} - ${errorText}`);
          (error as any).statusCode = statusCode;
        } else if (statusCode >= 400) {
          error = new Error(`Client error: ${statusCode} - ${errorText}`);
          (error as any).statusCode = statusCode;
        } else {
          error = new Error(`HTTP error: ${statusCode} - ${errorText}`);
          (error as any).statusCode = statusCode;
        }
        throw error;
      }

      await response.json(); // 读取响应但不使用（避免警告）
      return {
        success: true,
        processedCount: events.length,
        failedEvents: []
      };
    } catch (fetchError: any) {
      let error: Error;
      // 处理不同类型的错误
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
        error = new Error('Request timeout');
        (error as any).isTimeout = true;
      } else if (fetchError.message?.includes('Failed to fetch') || 
                 fetchError.message?.includes('network')) {
        error = new Error(`Network error: ${fetchError.message}`);
        (error as any).isNetworkError = true;
      } else {
        error = fetchError;
      }
      throw error;
    }
  }

  // 处理失败的事件
  private handleFailedEvents(failedEvents: QueuedEvent[], error?: Error): void {
    const errorType = this.classifyError(error);
    
    failedEvents.forEach(event => {
      event.retryCount++;
      
      if (event.retryCount < this.batchConfig.maxRetries) {
        // 使用优化的指数退避算法
        const backoffDelay = this.calculateBackoffDelay(event.retryCount, errorType);
        
        // 记录重试信息
        const retryRecord: RetryRecord = {
          eventId: event.id,
          retryCount: event.retryCount,
          lastRetryTime: Date.now(),
          nextRetryTime: Date.now() + backoffDelay,
          backoffDelay,
          errorType
        };
        this.retryRecords.set(event.id, retryRecord);
        
        // 清除之前的定时器（如果存在）
        const existingTimer = this.retryTimers.get(event.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // 设置新的重试定时器
        const timer = setTimeout(() => {
          this.retryTimers.delete(event.id);
          this.eventQueue.push(event);
          console.log(`事件 ${event.id} 第 ${event.retryCount} 次重试，延迟 ${backoffDelay}ms`);
        }, backoffDelay);
        
        this.retryTimers.set(event.id, timer);
      } else {
        // 超过最大重试次数，保存到离线存储
        console.warn(`事件 ${event.id} 重试次数超限（${event.retryCount}次），保存到离线存储`);
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

  // 分类错误类型
  private classifyError(error?: Error): ErrorType {
    if (!error) {
      return 'unknown';
    }

    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    // 网络错误
    if (errorMessage.includes('network') || 
        errorMessage.includes('fetch') || 
        errorMessage.includes('connection') ||
        errorName === 'networkerror' ||
        errorName === 'typeerror') {
      return 'network';
    }

    // 超时错误
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('aborted') ||
        errorName === 'timeouterror' ||
        errorName === 'aborterror') {
      return 'timeout';
    }

    // 服务器错误（5xx）
    if (errorMessage.includes('500') || 
        errorMessage.includes('502') || 
        errorMessage.includes('503') ||
        errorMessage.includes('504') ||
        errorMessage.includes('server error')) {
      return 'server';
    }

    // 客户端错误（4xx）
    if (errorMessage.includes('400') || 
        errorMessage.includes('401') || 
        errorMessage.includes('403') ||
        errorMessage.includes('404') ||
        errorMessage.includes('client error')) {
      return 'client';
    }

    return 'unknown';
  }

  // 计算指数退避延迟
  private calculateBackoffDelay(retryCount: number, errorType: ErrorType): number {
    const backoffConfig = this.batchConfig.exponentialBackoff;
    
    // 如果不启用指数退避，使用简单的线性退避（向后兼容）
    if (!backoffConfig?.enabled) {
      return this.batchConfig.retryDelay * retryCount;
    }

    // 基础延迟
    let baseDelay = backoffConfig.baseDelay;

    // 根据错误类型调整基础延迟
    if (backoffConfig.errorTypeAware) {
      const errorTypeMultiplier = {
        network: 1.2,    // 网络错误增加20%延迟
        timeout: 1.5,    // 超时错误增加50%延迟
        server: 1.0,    // 服务器错误保持原样
        client: 0.8,    // 客户端错误减少20%延迟（可能是临时问题）
        unknown: 1.0
      };
      baseDelay = baseDelay * errorTypeMultiplier[errorType];
    }

    // 根据网络状况调整基础延迟
    if (backoffConfig.networkAware && this.networkMetrics) {
      const networkMultiplier = {
        excellent: 0.8,  // 网络好时减少延迟
        good: 0.9,
        fair: 1.1,      // 网络一般时增加延迟
        poor: 1.5       // 网络差时大幅增加延迟
      };
      baseDelay = baseDelay * networkMultiplier[this.networkMetrics.quality];
    }

    // 计算指数退避：baseDelay * multiplier^retryCount
    let delay = baseDelay * Math.pow(backoffConfig.multiplier, retryCount - 1);

    // 应用最大延迟限制
    delay = Math.min(delay, backoffConfig.maxDelay);

    // 添加抖动（jitter）避免雷群效应
    if (backoffConfig.jitterEnabled) {
      const jitterRange = delay * backoffConfig.jitterRatio;
      const jitter = (Math.random() * 2 - 1) * jitterRange; // ±jitterRange
      delay = Math.max(100, delay + jitter); // 确保最小延迟100ms
    }

    return Math.round(delay);
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
    const wasAdaptiveEnabled = this.batchConfig.adaptive?.enabled;
    const wasBackoffEnabled = this.batchConfig.exponentialBackoff?.enabled;
    
    this.batchConfig = { ...this.batchConfig, ...newConfig };
    
    // 如果自适应配置更新，需要重新初始化
    if (newConfig.adaptive !== undefined) {
      if (this.batchConfig.adaptive?.enabled && !wasAdaptiveEnabled) {
        // 从禁用变为启用
        this.initAdaptiveBatchSize();
      } else if (!this.batchConfig.adaptive?.enabled && wasAdaptiveEnabled) {
        // 从启用变为禁用
        this.stopNetworkCheckTimer();
        this.stopAdjustmentTimer();
        this.currentBatchSize = this.batchConfig.maxBatchSize;
      } else if (this.batchConfig.adaptive?.enabled) {
        // 配置更新，重启定时器
        this.stopNetworkCheckTimer();
        this.stopAdjustmentTimer();
        this.startNetworkCheckTimer();
        this.startAdjustmentTimer();
      }
    }

    // 如果指数退避配置更新
    if (newConfig.exponentialBackoff !== undefined) {
      if (!this.batchConfig.exponentialBackoff?.enabled && wasBackoffEnabled) {
        // 从启用变为禁用，清除所有重试定时器
        this.clearRetryRecords();
      }
    }
    
    // 重启刷新定时器
    this.stopFlushTimer();
    this.startFlushTimer();
  }

  // 获取网络状况（公开方法）
  public getNetworkMetrics(): NetworkMetrics | null {
    return this.networkMetrics ? { ...this.networkMetrics } : null;
  }

  // 获取自适应批量大小状态（公开方法）
  public getAdaptiveBatchStatus(): {
    enabled: boolean;
    currentBatchSize: number;
    networkMetrics: NetworkMetrics | null;
    queueLength: number;
    recentSuccessRate: number;
  } {
    return {
      enabled: this.batchConfig.adaptive?.enabled || false,
      currentBatchSize: this.currentBatchSize,
      networkMetrics: this.getNetworkMetrics(),
      queueLength: this.eventQueue.length,
      recentSuccessRate: this.networkHistory.successRate
    };
  }

  // 手动触发批量大小调整（公开方法）
  public adjustBatchSizeManually(): void {
    if (this.batchConfig.adaptive?.enabled) {
      this.adjustBatchSize();
    }
  }

  // 手动触发网络检测（公开方法）
  public checkNetworkManually(): Promise<void> {
    return this.checkNetworkStatus();
  }

  // 获取重试记录（公开方法）
  public getRetryRecords(): RetryRecord[] {
    return Array.from(this.retryRecords.values());
  }

  // 获取指定事件的重试记录（公开方法）
  public getRetryRecord(eventId: string): RetryRecord | undefined {
    return this.retryRecords.get(eventId);
  }

  // 清除重试记录（公开方法）
  public clearRetryRecords(): void {
    // 清除所有定时器
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
    this.retryRecords.clear();
  }

  // 取消指定事件的重试（公开方法）
  public cancelRetry(eventId: string): boolean {
    const timer = this.retryTimers.get(eventId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(eventId);
      this.retryRecords.delete(eventId);
      return true;
    }
    return false;
  }

  // 获取重试统计信息（公开方法）
  public getRetryStatistics(): {
    totalRetries: number;
    activeRetries: number;
    retriesByErrorType: Record<ErrorType, number>;
    avgBackoffDelay: number;
    maxBackoffDelay: number;
  } {
    const records = Array.from(this.retryRecords.values());
    const retriesByErrorType: Record<ErrorType, number> = {
      network: 0,
      timeout: 0,
      server: 0,
      client: 0,
      unknown: 0
    };

    let totalBackoffDelay = 0;
    let maxBackoffDelay = 0;

    records.forEach(record => {
      retriesByErrorType[record.errorType]++;
      totalBackoffDelay += record.backoffDelay;
      maxBackoffDelay = Math.max(maxBackoffDelay, record.backoffDelay);
    });

    return {
      totalRetries: records.length,
      activeRetries: this.retryTimers.size,
      retriesByErrorType,
      avgBackoffDelay: records.length > 0 ? totalBackoffDelay / records.length : 0,
      maxBackoffDelay
    };
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

  // 初始化白屏检测
  private initBlankScreenDetection(): void {
    if (!this.blankScreenConfig.enabled) {
      return;
    }

    // 等待页面加载完成后再开始检测
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.startBlankScreenDetection();
      });
    } else {
      // 页面已加载，延迟一下再开始检测（给React等框架时间渲染）
      setTimeout(() => {
        this.startBlankScreenDetection();
      }, 2000);
    }
  }

  // 启动白屏检测
  private startBlankScreenDetection(): void {
    // 使用MutationObserver监听DOM变化
    this.initMutationObserver();

    // 启动定时检测
    this.startBlankScreenTimer();

    // 页面可见性变化时重新检测
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.lastContentCheckTime = Date.now();
        this.blankScreenReported = false;
        this.checkBlankScreen();
      }
    });
  }

  // 初始化MutationObserver
  private initMutationObserver(): void {
    if (!window.MutationObserver) {
      console.warn('MutationObserver not supported, using fallback detection');
      return;
    }

    const rootElement = document.querySelector(this.blankScreenConfig.rootSelector);
    if (!rootElement) {
      console.warn(`Root element ${this.blankScreenConfig.rootSelector} not found`);
      return;
    }

    this.blankScreenObserver = new MutationObserver(() => {
      // DOM发生变化，更新最后检查时间
      this.lastContentCheckTime = Date.now();
      // 如果之前报告过白屏，现在有变化了，重置标志
      if (this.blankScreenReported) {
        this.blankScreenReported = false;
      }
    });

    // 监听根元素及其子元素的变化
    this.blankScreenObserver.observe(rootElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: true
    });
  }

  // 启动白屏检测定时器
  private startBlankScreenTimer(): void {
    if (this.blankScreenCheckTimer) {
      clearInterval(this.blankScreenCheckTimer);
    }

    this.blankScreenCheckTimer = setInterval(() => {
      this.checkBlankScreen();
    }, this.blankScreenConfig.checkInterval);
  }

  // 停止白屏检测定时器
  private stopBlankScreenTimer(): void {
    if (this.blankScreenCheckTimer) {
      clearInterval(this.blankScreenCheckTimer);
      this.blankScreenCheckTimer = null;
    }
  }

  // 检测白屏
  private checkBlankScreen(): void {
    // 如果已经报告过白屏，避免重复报告
    if (this.blankScreenReported) {
      return;
    }

    const rootElement = document.querySelector(this.blankScreenConfig.rootSelector);
    if (!rootElement) {
      return;
    }

    // 检查根元素是否有内容
    const hasContent = this.hasPageContent(rootElement);

    if (!hasContent) {
      // 检查是否超过阈值时间
      const timeSinceLastContent = Date.now() - this.lastContentCheckTime;
      
      if (timeSinceLastContent >= this.blankScreenConfig.threshold) {
        this.reportBlankScreen({
          检测时间: new Date().toISOString(),
          无内容持续时间: `${timeSinceLastContent}ms`,
          根元素选择器: this.blankScreenConfig.rootSelector,
          页面URL: window.location.href,
          用户代理: navigator.userAgent
        });
        this.blankScreenReported = true;
      }
    } else {
      // 有内容，更新最后检查时间
      this.lastContentCheckTime = Date.now();
    }
  }

  // 检查页面是否有内容
  private hasPageContent(element: Element | null): boolean {
    if (!element) {
      return false;
    }

    // 检查元素是否有文本内容（去除空白字符）
    const textContent = element.textContent?.trim() || '';
    if (textContent.length > 0) {
      return true;
    }

    // 检查是否有子元素
    const children = element.children;
    if (children.length > 0) {
      // 递归检查子元素
      for (let i = 0; i < children.length; i++) {
        if (this.hasPageContent(children[i])) {
          return true;
        }
      }
    }

    // 检查是否有图片
    const images = element.querySelectorAll('img');
    if (images.length > 0) {
      return true;
    }

    // 检查是否有SVG
    const svgs = element.querySelectorAll('svg');
    if (svgs.length > 0) {
      return true;
    }

    // 检查是否有Canvas
    const canvases = element.querySelectorAll('canvas');
    if (canvases.length > 0) {
      return true;
    }

    // 检查关键元素是否存在
    for (const selector of this.blankScreenConfig.checkElements) {
      if (selector !== this.blankScreenConfig.rootSelector) {
        const element = document.querySelector(selector);
        if (element && this.hasPageContent(element)) {
          return true;
        }
      }
    }

    return false;
  }

  // 上报白屏事件
  private reportBlankScreen(details: Record<string, any>): void {
    this.track('blankScreen', {
      白屏类型: '页面无内容',
      ...details
    }, 'high'); // 白屏事件使用高优先级

    console.warn('检测到白屏:', details);
  }

  // 专门用于白屏事件的方法
  public trackBlankScreen(blankScreenType: string, details: Record<string, any>) {
    this.track('blankScreen', {
      白屏类型: blankScreenType,
      ...details,
      检测时间: new Date().toISOString()
    }, 'high'); // 白屏事件使用高优先级
  }

  // 更新白屏检测配置
  public updateBlankScreenConfig(newConfig: Partial<BlankScreenConfig>): void {
    const wasEnabled = this.blankScreenConfig.enabled;
    this.blankScreenConfig = { ...this.blankScreenConfig, ...newConfig };

    if (this.blankScreenConfig.enabled && !wasEnabled) {
      // 从禁用变为启用，重新初始化
      this.initBlankScreenDetection();
    } else if (!this.blankScreenConfig.enabled && wasEnabled) {
      // 从启用变为禁用，清理资源
      this.destroyBlankScreenDetection();
    } else if (this.blankScreenConfig.enabled) {
      // 配置更新，重启检测
      this.destroyBlankScreenDetection();
      this.startBlankScreenDetection();
    }
  }

  // 销毁白屏检测（清理资源）
  private destroyBlankScreenDetection(): void {
    this.stopBlankScreenTimer();
    
    if (this.blankScreenObserver) {
      this.blankScreenObserver.disconnect();
      this.blankScreenObserver = null;
    }

    this.blankScreenReported = false;
  }

  // 获取白屏检测状态
  public getBlankScreenStatus(): { enabled: boolean; config: BlankScreenConfig } {
    return {
      enabled: this.blankScreenConfig.enabled,
      config: { ...this.blankScreenConfig }
    };
  }
}

export default AnalyticsSDK; 