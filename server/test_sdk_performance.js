/**
 * SDK批量发送性能测试
 * 测试SDK在百万级数据下的批量发送性能
 * 
 * 使用方法：
 * 1. 确保后端服务已启动
 * 2. 修改 PROJECT_ID 为您的项目ID
 * 3. 运行: node test_sdk_performance.js
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE = 'http://localhost:3000/api';
const PROJECT_ID = 'perf-test-project'; // 修改为您的项目ID
const BATCH_SIZES = [10, 50, 100, 200]; // 测试不同的批量大小
const TOTAL_EVENTS = 10000; // 总共发送1万条事件

// 生成测试事件
function generateEvent(index) {
  return {
    eventName: `test_event_${index % 10}`,
    eventParams: {
      page: `/test/page/${index}`,
      index: index,
      timestamp: Date.now()
    },
    timestamp: Date.now()
  };
}

// 测试批量发送
async function testBatchSend(batchSize) {
  console.log(`\n测试批量大小: ${batchSize}`);
  
  const events = [];
  for (let i = 0; i < TOTAL_EVENTS; i++) {
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
  
  // 并发发送（最多5个并发）
  const concurrency = 5;
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchPromises = batches.slice(i, i + concurrency).map(async (batch) => {
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
        });
        
        if (response.data.success) {
          successCount += batch.length;
        } else {
          failCount += batch.length;
        }
      } catch (error) {
        failCount += batch.length;
        console.error(`批量发送失败: ${error.message}`);
      }
    });
    
    await Promise.all(batchPromises);
    
    // 显示进度
    if ((i + concurrency) % 50 === 0 || i + concurrency >= batches.length) {
      const progress = ((i + concurrency) / batches.length * 100).toFixed(1);
      console.log(`进度: ${progress}% (${i + concurrency}/${batches.length} 批)`);
    }
  }
  
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000; // 秒
  
  console.log(`\n批量大小: ${batchSize}`);
  console.log(`总事件数: ${TOTAL_EVENTS}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`耗时: ${duration.toFixed(2)} 秒`);
  console.log(`吞吐量: ${(TOTAL_EVENTS / duration).toFixed(2)} 事件/秒`);
  console.log(`平均延迟: ${(duration / batches.length * 1000).toFixed(2)} 毫秒/批`);
  
  return {
    batchSize,
    totalEvents: TOTAL_EVENTS,
    successCount,
    failCount,
    duration,
    throughput: TOTAL_EVENTS / duration,
    avgLatency: duration / batches.length * 1000,
    successRate: (successCount / TOTAL_EVENTS) * 100
  };
}

// 运行测试
async function runTests() {
  console.log('========================================');
  console.log('SDK批量发送性能测试');
  console.log('========================================');
  console.log(`项目ID: ${PROJECT_ID}`);
  console.log(`总事件数: ${TOTAL_EVENTS}`);
  console.log(`测试批量大小: ${BATCH_SIZES.join(', ')}`);
  console.log('========================================\n');
  
  const results = [];
  
  for (const batchSize of BATCH_SIZES) {
    const result = await testBatchSend(batchSize);
    results.push(result);
    
    // 等待一段时间再测试下一个批量大小
    console.log('\n等待2秒后继续下一个测试...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 输出总结
  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================');
  console.table(results.map(r => ({
    '批量大小': r.batchSize,
    '吞吐量(事件/秒)': r.throughput.toFixed(2),
    '平均延迟(毫秒)': r.avgLatency.toFixed(2),
    '成功率': r.successRate.toFixed(2) + '%'
  })));
  
  // 找出最佳批量大小
  const bestResult = results.reduce((best, current) => 
    current.throughput > best.throughput ? current : best
  );
  console.log(`\n最佳批量大小: ${bestResult.batchSize} (吞吐量: ${bestResult.throughput.toFixed(2)} 事件/秒)`);
}

runTests().catch(console.error);


