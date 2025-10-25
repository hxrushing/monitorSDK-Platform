// SDK批量发送机制测试文件

import AnalyticsSDK from './index';

// 测试配置
const testConfig = {
  maxBatchSize: 5,         // 小批量用于测试
  flushInterval: 2000,      // 2秒刷新
  maxRetries: 2,           // 2次重试
  retryDelay: 1000,        // 1秒延迟
  enableOfflineStorage: true,
  maxStorageSize: 1024 * 1024, // 1MB
};

// 创建测试SDK实例
const testSdk = AnalyticsSDK.getInstance('test-project', 'http://localhost:3000/api/track', testConfig);

// 测试函数
export class BatchSendTester {
  private sdk: AnalyticsSDK;
  private testResults: any[] = [];

  constructor(sdk: AnalyticsSDK) {
    this.sdk = sdk;
  }

  // 测试1: 基本批量发送
  async testBasicBatchSend(): Promise<void> {
    console.log('🧪 测试1: 基本批量发送');
    
    // 发送5个事件（达到批量大小）
    for (let i = 1; i <= 5; i++) {
      this.sdk.track('test_event', {
        testId: i,
        message: `测试事件 ${i}`,
        timestamp: Date.now()
      });
    }

    // 检查队列状态
    const status = this.sdk.getQueueStatus();
    console.log('队列状态:', status);

    // 手动刷新
    await this.sdk.flush();
    console.log('✅ 基本批量发送测试完成');
  }

  // 测试2: 优先级测试
  async testPriorityHandling(): Promise<void> {
    console.log('🧪 测试2: 优先级处理');
    
    // 发送低优先级事件
    this.sdk.track('low_priority_event', { priority: 'low' }, 'low');
    
    // 发送普通优先级事件
    this.sdk.track('normal_priority_event', { priority: 'normal' }, 'normal');
    
    // 发送高优先级事件
    this.sdk.track('high_priority_event', { priority: 'high' }, 'high');
    
    // 检查队列状态
    const status = this.sdk.getQueueStatus();
    console.log('优先级测试队列状态:', status);
    
    await this.sdk.flush();
    console.log('✅ 优先级处理测试完成');
  }

  // 测试3: 离线存储测试
  async testOfflineStorage(): Promise<void> {
    console.log('🧪 测试3: 离线存储');
    
    // 模拟离线状态
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    // 发送一些事件
    for (let i = 1; i <= 3; i++) {
      this.sdk.track('offline_event', {
        testId: i,
        message: `离线事件 ${i}`
      });
    }

    // 检查是否保存到本地存储
    const storageKey = `analytics_events_test-project`;
    const storedEvents = localStorage.getItem(storageKey);
    console.log('离线存储的事件:', storedEvents ? JSON.parse(storedEvents).length : 0);

    // 恢复在线状态
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // 触发在线事件
    window.dispatchEvent(new Event('online'));
    
    console.log('✅ 离线存储测试完成');
  }

  // 测试4: 重试机制测试
  async testRetryMechanism(): Promise<void> {
    console.log('🧪 测试4: 重试机制');
    
    // 使用错误的端点测试重试
    const errorSdk = AnalyticsSDK.getInstance('test-project', 'http://invalid-endpoint/api/track', {
      maxBatchSize: 2,
      flushInterval: 1000,
      maxRetries: 2,
      retryDelay: 500,
      enableOfflineStorage: true,
      maxStorageSize: 1024 * 1024,
    });

    // 发送事件
    errorSdk.track('retry_test_event', { testId: 1 });
    errorSdk.track('retry_test_event', { testId: 2 });

    // 等待重试
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = errorSdk.getQueueStatus();
    console.log('重试测试队列状态:', status);
    
    console.log('✅ 重试机制测试完成');
  }

  // 测试5: 性能测试
  async testPerformance(): Promise<void> {
    console.log('🧪 测试5: 性能测试');
    
    const startTime = Date.now();
    
    // 发送大量事件
    for (let i = 1; i <= 100; i++) {
      this.sdk.track('performance_test', {
        index: i,
        timestamp: Date.now()
      });
    }

    const queueTime = Date.now() - startTime;
    console.log(`队列添加100个事件耗时: ${queueTime}ms`);

    // 等待批量发送
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = this.sdk.getQueueStatus();
    console.log('性能测试后队列状态:', status);
    
    console.log('✅ 性能测试完成');
  }

  // 运行所有测试
  async runAllTests(): Promise<void> {
    console.log('🚀 开始运行SDK批量发送机制测试');
    
    try {
      await this.testBasicBatchSend();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testPriorityHandling();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testOfflineStorage();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testRetryMechanism();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testPerformance();
      
      console.log('🎉 所有测试完成！');
    } catch (error) {
      console.error('❌ 测试过程中出现错误:', error);
    }
  }

  // 清理测试数据
  cleanup(): void {
    // 清理本地存储
    const storageKey = `analytics_events_test-project`;
    localStorage.removeItem(storageKey);
    
    // 清理SDK实例
    AnalyticsSDK.clearInstance('test-project', 'http://localhost:3000/api/track');
    AnalyticsSDK.clearInstance('test-project', 'http://invalid-endpoint/api/track');
    
    console.log('🧹 测试数据清理完成');
  }
}

// 导出测试器
export const batchTester = new BatchSendTester(testSdk);

// 在浏览器控制台中运行测试
if (typeof window !== 'undefined') {
  (window as any).runBatchTests = () => batchTester.runAllTests();
  (window as any).cleanupBatchTests = () => batchTester.cleanup();
  
  console.log('💡 在控制台中运行以下命令进行测试:');
  console.log('runBatchTests() - 运行所有测试');
  console.log('cleanupBatchTests() - 清理测试数据');
}
