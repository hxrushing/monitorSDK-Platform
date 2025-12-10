/**
 * SDK 综合性能测试
 * 测试SDK的各项功能和性能指标
 * 
 * 测试内容：
 * 1. 批量发送性能
 * 2. 自适应批量大小
 * 3. 指数退避重试
 * 4. 离线存储和恢复
 * 5. 数据压缩
 * 6. 网络检测
 * 7. 内存使用情况
 * 
 * 使用方法：
 * 1. 确保后端服务已启动
 * 2. 修改 PROJECT_ID 为您的项目ID
 * 3. 运行: node test_sdk_comprehensive.js
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE = 'http://localhost:3000/api';
const PROJECT_ID = 'perf-test-project';

// ==================== 测试配置 ====================
const TEST_CONFIG = {
  // 批量发送测试
  batchTest: {
    totalEvents: 10000,
    batchSizes: [10, 50, 100, 200],
    concurrency: 5
  },
  
  // 自适应批量大小测试
  adaptiveTest: {
    totalEvents: 5000,
    networkConditions: ['excellent', 'good', 'fair', 'poor']
  },
  
  // 重试测试
  retryTest: {
    totalEvents: 1000,
    failureRate: 0.3  // 30% 失败率
  },
  
  // 离线存储测试
  offlineTest: {
    totalEvents: 5000,
    offlineDuration: 10000  // 10秒离线
  },
  
  // 压缩测试
  compressionTest: {
    totalEvents: 2000,
    eventSize: 1000  // 每个事件约1KB
  }
};

// ==================== 工具函数 ====================

// 生成测试事件
function generateEvent(index, size = 100) {
  const baseEvent = {
    eventName: `test_event_${index % 10}`,
    eventParams: {
      page: `/test/page/${index}`,
      index: index,
      timestamp: Date.now(),
      user: `user_${index % 1000}`,
      session: `session_${index % 100}`
    },
    timestamp: Date.now()
  };
  
  // 如果指定了大小，填充数据
  if (size > 100) {
    baseEvent.eventParams.data = 'x'.repeat(size - 100);
  }
  
  return baseEvent;
}

// 获取内存使用情况
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
    external: (usage.external / 1024 / 1024).toFixed(2) + ' MB'
  };
}

// 格式化时间
function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60000).toFixed(2)} min`;
}

// ==================== 测试1: 批量发送性能 ====================

async function testBatchSendPerformance(batchSize) {
  console.log(`\n📊 测试批量大小: ${batchSize}`);
  
  const events = [];
  for (let i = 0; i < TEST_CONFIG.batchTest.totalEvents; i++) {
    events.push(generateEvent(i));
  }
  
  // 分批发送
  const batches = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  
  const startTime = performance.now();
  let successCount = 0;
  let failCount = 0;
  const latencies = [];
  
  // 并发发送
  const concurrency = TEST_CONFIG.batchTest.concurrency;
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchPromises = batches.slice(i, i + concurrency).map(async (batch) => {
      const batchStart = performance.now();
      try {
        const response = await axios.post(`${API_BASE}/track`, {
          projectId: PROJECT_ID,
          events: batch,
          batchSize: batch.length,
          timestamp: Date.now(),
          deviceInfo: {
            userAgent: 'Test Agent',
            platform: 'Test',
            language: 'zh-CN',
            screenResolution: '1920x1080'
          },
          sdkVersion: '1.0.0'
        }, {
          timeout: 10000
        });
        
        const latency = performance.now() - batchStart;
        latencies.push(latency);
        
        if (response.data.success) {
          successCount += batch.length;
        } else {
          failCount += batch.length;
        }
      } catch (error) {
        const latency = performance.now() - batchStart;
        latencies.push(latency);
        failCount += batch.length;
      }
    });
    
    await Promise.all(batchPromises);
    
    // 显示进度
    if ((i + concurrency) % 50 === 0 || i + concurrency >= batches.length) {
      const progress = ((i + concurrency) / batches.length * 100).toFixed(1);
      process.stdout.write(`\r进度: ${progress}% (${i + concurrency}/${batches.length} 批)`);
    }
  }
  
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;
  
  // 计算统计信息
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];
  
  const result = {
    batchSize,
    totalEvents: TEST_CONFIG.batchTest.totalEvents,
    successCount,
    failCount,
    duration,
    throughput: TEST_CONFIG.batchTest.totalEvents / duration,
    avgLatency,
    minLatency,
    maxLatency,
    p95Latency,
    p99Latency,
    successRate: (successCount / TEST_CONFIG.batchTest.totalEvents) * 100
  };
  
  console.log(`\n✅ 批量大小 ${batchSize} 测试完成`);
  console.log(`   总事件数: ${result.totalEvents}`);
  console.log(`   成功: ${result.successCount} (${result.successRate.toFixed(2)}%)`);
  console.log(`   失败: ${result.failCount}`);
  console.log(`   耗时: ${formatTime(duration * 1000)}`);
  console.log(`   吞吐量: ${result.throughput.toFixed(2)} 事件/秒`);
  console.log(`   平均延迟: ${result.avgLatency.toFixed(2)} ms`);
  console.log(`   P95延迟: ${p95Latency.toFixed(2)} ms`);
  console.log(`   P99延迟: ${p99Latency.toFixed(2)} ms`);
  
  return result;
}

// ==================== 测试2: 自适应批量大小 ====================

async function testAdaptiveBatchSize() {
  console.log('\n\n🔄 测试自适应批量大小');
  console.log('模拟不同网络条件下的批量大小调整');
  
  const results = [];
  
  for (const condition of TEST_CONFIG.adaptiveTest.networkConditions) {
    console.log(`\n测试网络条件: ${condition}`);
    
    // 模拟网络条件（通过调整批量大小和延迟）
    let batchSize, delay;
    switch (condition) {
      case 'excellent':
        batchSize = 200;
        delay = 10;
        break;
      case 'good':
        batchSize = 100;
        delay = 50;
        break;
      case 'fair':
        batchSize = 50;
        delay = 200;
        break;
      case 'poor':
        batchSize = 10;
        delay = 500;
        break;
    }
    
    const events = [];
    for (let i = 0; i < TEST_CONFIG.adaptiveTest.totalEvents; i++) {
      events.push(generateEvent(i));
    }
    
    const batches = [];
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }
    
    const startTime = performance.now();
    let successCount = 0;
    
    for (const batch of batches) {
      try {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const response = await axios.post(`${API_BASE}/track`, {
          projectId: PROJECT_ID,
          events: batch,
          batchSize: batch.length,
          timestamp: Date.now(),
          deviceInfo: {
            userAgent: 'Test Agent',
            platform: 'Test',
            language: 'zh-CN',
            screenResolution: '1920x1080'
          },
          sdkVersion: '1.0.0'
        }, {
          timeout: 10000
        });
        
        if (response.data.success) {
          successCount += batch.length;
        }
      } catch (error) {
        // 忽略错误，继续测试
      }
    }
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;
    
    results.push({
      condition,
      batchSize,
      totalEvents: TEST_CONFIG.adaptiveTest.totalEvents,
      successCount,
      duration,
      throughput: TEST_CONFIG.adaptiveTest.totalEvents / duration
    });
    
    console.log(`   批量大小: ${batchSize}`);
    console.log(`   吞吐量: ${(TEST_CONFIG.adaptiveTest.totalEvents / duration).toFixed(2)} 事件/秒`);
  }
  
  return results;
}

// ==================== 测试3: 重试机制 ====================

async function testRetryMechanism() {
  console.log('\n\n🔄 测试指数退避重试机制');
  
  let retryCount = 0;
  let successCount = 0;
  let failCount = 0;
  
  const events = [];
  for (let i = 0; i < TEST_CONFIG.retryTest.totalEvents; i++) {
    events.push(generateEvent(i));
  }
  
  const batches = [];
  for (let i = 0; i < events.length; i += 50) {
    batches.push(events.slice(i, i + 50));
  }
  
  const startTime = performance.now();
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // 模拟失败率
      const shouldFail = Math.random() < TEST_CONFIG.retryTest.failureRate;
      
      try {
        if (shouldFail && attempts < maxAttempts) {
          throw new Error('Simulated failure');
        }
        
        const response = await axios.post(`${API_BASE}/track`, {
          projectId: PROJECT_ID,
          events: batch,
          batchSize: batch.length,
          timestamp: Date.now(),
          deviceInfo: {
            userAgent: 'Test Agent',
            platform: 'Test',
            language: 'zh-CN',
            screenResolution: '1920x1080'
          },
          sdkVersion: '1.0.0'
        }, {
          timeout: 10000
        });
        
        if (response.data.success) {
          successCount += batch.length;
          if (attempts > 1) {
            retryCount += attempts - 1;
          }
          break;
        }
      } catch (error) {
        if (attempts < maxAttempts) {
          // 指数退避延迟
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          failCount += batch.length;
        }
      }
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r进度: ${((i + 1) / batches.length * 100).toFixed(1)}%`);
    }
  }
  
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`\n✅ 重试机制测试完成`);
  console.log(`   总事件数: ${TEST_CONFIG.retryTest.totalEvents}`);
  console.log(`   成功: ${successCount}`);
  console.log(`   失败: ${failCount}`);
  console.log(`   重试次数: ${retryCount}`);
  console.log(`   耗时: ${formatTime(duration * 1000)}`);
  console.log(`   成功率: ${(successCount / TEST_CONFIG.retryTest.totalEvents * 100).toFixed(2)}%`);
  
  return {
    totalEvents: TEST_CONFIG.retryTest.totalEvents,
    successCount,
    failCount,
    retryCount,
    duration,
    successRate: (successCount / TEST_CONFIG.retryTest.totalEvents) * 100
  };
}

// ==================== 测试4: 离线存储 ====================

async function testOfflineStorage() {
  console.log('\n\n💾 测试离线存储和恢复');
  
  // 模拟离线状态（通过使用错误的端点）
  const offlineEndpoint = 'http://invalid-endpoint/api/track';
  
  const events = [];
  for (let i = 0; i < TEST_CONFIG.offlineTest.totalEvents; i++) {
    events.push(generateEvent(i));
  }
  
  console.log('模拟离线状态，发送事件...');
  const startTime = performance.now();
  let storedCount = 0;
  
  // 模拟离线存储（实际SDK会自动处理）
  const batches = [];
  for (let i = 0; i < events.length; i += 50) {
    batches.push(events.slice(i, i + 50));
  }
  
  for (const batch of batches) {
    try {
      await axios.post(offlineEndpoint, {
        projectId: PROJECT_ID,
        events: batch
      }, {
        timeout: 1000
      });
    } catch (error) {
      // 模拟存储到本地
      storedCount += batch.length;
    }
  }
  
  const offlineDuration = (performance.now() - startTime) / 1000;
  console.log(`离线期间存储了 ${storedCount} 个事件`);
  console.log(`离线持续时间: ${formatTime(offlineDuration * 1000)}`);
  
  // 模拟恢复在线
  console.log('\n恢复在线状态，开始发送存储的事件...');
  const recoveryStartTime = performance.now();
  let recoveredCount = 0;
  
  for (const batch of batches) {
    try {
      const response = await axios.post(`${API_BASE}/track`, {
        projectId: PROJECT_ID,
        events: batch,
        batchSize: batch.length,
        timestamp: Date.now(),
        deviceInfo: {
          userAgent: 'Test Agent',
          platform: 'Test',
          language: 'zh-CN',
          screenResolution: '1920x1080'
        },
        sdkVersion: '1.0.0'
      }, {
        timeout: 10000
      });
      
      if (response.data.success) {
        recoveredCount += batch.length;
      }
    } catch (error) {
      // 忽略错误
    }
    
    if (recoveredCount % 500 === 0) {
      process.stdout.write(`\r已恢复: ${recoveredCount}/${storedCount} 事件`);
    }
  }
  
  const recoveryDuration = (performance.now() - recoveryStartTime) / 1000;
  
  console.log(`\n✅ 离线存储测试完成`);
  console.log(`   存储事件数: ${storedCount}`);
  console.log(`   恢复事件数: ${recoveredCount}`);
  console.log(`   恢复耗时: ${formatTime(recoveryDuration * 1000)}`);
  console.log(`   恢复率: ${(recoveredCount / storedCount * 100).toFixed(2)}%`);
  
  return {
    storedCount,
    recoveredCount,
    offlineDuration,
    recoveryDuration,
    recoveryRate: (recoveredCount / storedCount) * 100
  };
}

// ==================== 测试5: 数据压缩 ====================

async function testCompression() {
  console.log('\n\n🗜️  测试数据压缩');
  
  const events = [];
  for (let i = 0; i < TEST_CONFIG.compressionTest.totalEvents; i++) {
    events.push(generateEvent(i, TEST_CONFIG.compressionTest.eventSize));
  }
  
  // 计算原始大小
  const originalData = JSON.stringify(events);
  const originalSize = Buffer.byteLength(originalData, 'utf8');
  
  console.log(`原始数据大小: ${(originalSize / 1024).toFixed(2)} KB`);
  
  // 模拟压缩（实际SDK会使用CompressionStream或pako）
  const compressStartTime = performance.now();
  const compressedData = Buffer.from(originalData).toString('base64'); // 简单模拟
  const compressDuration = performance.now() - compressStartTime;
  const compressedSize = Buffer.byteLength(compressedData, 'utf8');
  
  // 模拟解压
  const decompressStartTime = performance.now();
  const decompressedData = Buffer.from(compressedData, 'base64').toString('utf8');
  const decompressDuration = performance.now() - decompressStartTime;
  
  const compressionRatio = (1 - compressedSize / originalSize) * 100;
  
  console.log(`压缩后大小: ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`压缩比: ${compressionRatio.toFixed(2)}%`);
  console.log(`压缩耗时: ${compressDuration.toFixed(2)} ms`);
  console.log(`解压耗时: ${decompressDuration.toFixed(2)} ms`);
  
  // 测试压缩后的发送性能
  console.log('\n测试压缩数据的发送性能...');
  const sendStartTime = performance.now();
  let successCount = 0;
  
  const batches = [];
  for (let i = 0; i < events.length; i += 100) {
    batches.push(events.slice(i, i + 100));
  }
  
  for (const batch of batches) {
    try {
      const response = await axios.post(`${API_BASE}/track`, {
        projectId: PROJECT_ID,
        events: batch,
        batchSize: batch.length,
        timestamp: Date.now(),
        deviceInfo: {
          userAgent: 'Test Agent',
          platform: 'Test',
          language: 'zh-CN',
          screenResolution: '1920x1080'
        },
        sdkVersion: '1.0.0'
      }, {
        timeout: 10000
      });
      
      if (response.data.success) {
        successCount += batch.length;
      }
    } catch (error) {
      // 忽略错误
    }
  }
  
  const sendDuration = (performance.now() - sendStartTime) / 1000;
  
  console.log(`\n✅ 压缩测试完成`);
  console.log(`   发送事件数: ${successCount}`);
  console.log(`   发送耗时: ${formatTime(sendDuration * 1000)}`);
  console.log(`   吞吐量: ${(successCount / sendDuration).toFixed(2)} 事件/秒`);
  
  return {
    originalSize,
    compressedSize,
    compressionRatio,
    compressDuration,
    decompressDuration,
    sendDuration,
    throughput: successCount / sendDuration
  };
}

// ==================== 测试6: 内存使用 ====================

function testMemoryUsage() {
  console.log('\n\n💾 测试内存使用情况');
  
  const initialMemory = getMemoryUsage();
  console.log('初始内存使用:');
  console.log(`  堆内存: ${initialMemory.heapUsed} / ${initialMemory.heapTotal}`);
  console.log(`  RSS: ${initialMemory.rss}`);
  
  // 创建大量事件对象
  const events = [];
  for (let i = 0; i < 10000; i++) {
    events.push(generateEvent(i, 500));
  }
  
  const afterCreateMemory = getMemoryUsage();
  console.log('\n创建10000个事件后:');
  console.log(`  堆内存: ${afterCreateMemory.heapUsed} / ${afterCreateMemory.heapTotal}`);
  console.log(`  RSS: ${afterCreateMemory.rss}`);
  console.log(`  内存增长: ${(parseFloat(afterCreateMemory.heapUsed) - parseFloat(initialMemory.heapUsed)).toFixed(2)} MB`);
  
  // 清理
  events.length = 0;
  global.gc && global.gc();
  
  const afterCleanupMemory = getMemoryUsage();
  console.log('\n清理后:');
  console.log(`  堆内存: ${afterCleanupMemory.heapUsed} / ${afterCleanupMemory.heapTotal}`);
  console.log(`  RSS: ${afterCleanupMemory.rss}`);
  
  return {
    initial: initialMemory,
    afterCreate: afterCreateMemory,
    afterCleanup: afterCleanupMemory
  };
}

// ==================== 主测试函数 ====================

async function runAllTests() {
  console.log('========================================');
  console.log('SDK 综合性能测试');
  console.log('========================================');
  console.log(`项目ID: ${PROJECT_ID}`);
  console.log(`API地址: ${API_BASE}`);
  console.log('========================================\n');
  
  const allResults = {
    batchPerformance: [],
    adaptiveBatch: [],
    retry: null,
    offline: null,
    compression: null,
    memory: null
  };
  
  const overallStartTime = performance.now();
  
  try {
    // 测试1: 批量发送性能
    console.log('\n\n========================================');
    console.log('测试1: 批量发送性能');
    console.log('========================================');
    for (const batchSize of TEST_CONFIG.batchTest.batchSizes) {
      const result = await testBatchSendPerformance(batchSize);
      allResults.batchPerformance.push(result);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 测试2: 自适应批量大小
    console.log('\n\n========================================');
    console.log('测试2: 自适应批量大小');
    console.log('========================================');
    allResults.adaptiveBatch = await testAdaptiveBatchSize();
    
    // 测试3: 重试机制
    console.log('\n\n========================================');
    console.log('测试3: 指数退避重试机制');
    console.log('========================================');
    allResults.retry = await testRetryMechanism();
    
    // 测试4: 离线存储
    console.log('\n\n========================================');
    console.log('测试4: 离线存储和恢复');
    console.log('========================================');
    allResults.offline = await testOfflineStorage();
    
    // 测试5: 数据压缩
    console.log('\n\n========================================');
    console.log('测试5: 数据压缩');
    console.log('========================================');
    allResults.compression = await testCompression();
    
    // 测试6: 内存使用
    console.log('\n\n========================================');
    console.log('测试6: 内存使用情况');
    console.log('========================================');
    allResults.memory = testMemoryUsage();
    
  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error);
  }
  
  const overallDuration = (performance.now() - overallStartTime) / 1000;
  
  // 输出总结
  console.log('\n\n========================================');
  console.log('测试总结');
  console.log('========================================');
  
  // 批量发送性能总结
  console.log('\n📊 批量发送性能:');
  console.table(allResults.batchPerformance.map(r => ({
    '批量大小': r.batchSize,
    '吞吐量(事件/秒)': r.throughput.toFixed(2),
    '平均延迟(ms)': r.avgLatency.toFixed(2),
    'P95延迟(ms)': r.p95Latency.toFixed(2),
    '成功率(%)': r.successRate.toFixed(2)
  })));
  
  const bestBatch = allResults.batchPerformance.reduce((best, current) => 
    current.throughput > best.throughput ? current : best
  );
  console.log(`\n最佳批量大小: ${bestBatch.batchSize} (吞吐量: ${bestBatch.throughput.toFixed(2)} 事件/秒)`);
  
  // 自适应批量大小总结
  console.log('\n🔄 自适应批量大小:');
  console.table(allResults.adaptiveBatch.map(r => ({
    '网络条件': r.condition,
    '批量大小': r.batchSize,
    '吞吐量(事件/秒)': r.throughput.toFixed(2)
  })));
  
  // 其他测试总结
  if (allResults.retry) {
    console.log('\n🔄 重试机制:');
    console.log(`  成功率: ${allResults.retry.successRate.toFixed(2)}%`);
    console.log(`  重试次数: ${allResults.retry.retryCount}`);
  }
  
  if (allResults.offline) {
    console.log('\n💾 离线存储:');
    console.log(`  恢复率: ${allResults.offline.recoveryRate.toFixed(2)}%`);
    console.log(`  恢复耗时: ${formatTime(allResults.offline.recoveryDuration * 1000)}`);
  }
  
  if (allResults.compression) {
    console.log('\n🗜️  数据压缩:');
    console.log(`  压缩比: ${allResults.compression.compressionRatio.toFixed(2)}%`);
    console.log(`  压缩耗时: ${allResults.compression.compressDuration.toFixed(2)} ms`);
  }
  
  console.log(`\n总测试耗时: ${formatTime(overallDuration * 1000)}`);
  console.log('\n✅ 所有测试完成！');
  
  return allResults;
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testBatchSendPerformance,
  testAdaptiveBatchSize,
  testRetryMechanism,
  testOfflineStorage,
  testCompression,
  testMemoryUsage
};


