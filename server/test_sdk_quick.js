/**
 * SDK 快速性能测试
 * 快速验证SDK的基本功能和性能
 * 
 * 使用方法：
 * 1. 确保后端服务已启动
 * 2. 修改 PROJECT_ID 为您的项目ID
 * 3. 运行: node test_sdk_quick.js
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE = 'http://localhost:3000/api';
const PROJECT_ID = 'perf-test-project';

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

// 快速测试
async function quickTest() {
  console.log('🚀 SDK 快速性能测试');
  console.log('========================================\n');
  
  const totalEvents = 1000;
  const batchSize = 50;
  
  console.log(`测试配置:`);
  console.log(`  总事件数: ${totalEvents}`);
  console.log(`  批量大小: ${batchSize}`);
  console.log(`  项目ID: ${PROJECT_ID}\n`);
  
  // 生成事件
  console.log('📦 生成测试事件...');
  const events = [];
  for (let i = 0; i < totalEvents; i++) {
    events.push(generateEvent(i));
  }
  console.log(`✅ 已生成 ${events.length} 个事件\n`);
  
  // 分批发送
  const batches = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  
  console.log(`📤 开始批量发送 (${batches.length} 批)...`);
  const startTime = performance.now();
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
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
      } else {
        failCount += batch.length;
      }
      
      process.stdout.write(`\r进度: ${((i + 1) / batches.length * 100).toFixed(1)}% (${i + 1}/${batches.length} 批)`);
    } catch (error) {
      failCount += batch.length;
      console.error(`\n❌ 批量 ${i + 1} 发送失败: ${error.message}`);
    }
  }
  
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log('\n\n========================================');
  console.log('测试结果');
  console.log('========================================');
  console.log(`总事件数: ${totalEvents}`);
  console.log(`成功: ${successCount} (${(successCount / totalEvents * 100).toFixed(2)}%)`);
  console.log(`失败: ${failCount} (${(failCount / totalEvents * 100).toFixed(2)}%)`);
  console.log(`耗时: ${duration.toFixed(2)} 秒`);
  console.log(`吞吐量: ${(totalEvents / duration).toFixed(2)} 事件/秒`);
  console.log(`平均延迟: ${(duration / batches.length * 1000).toFixed(2)} 毫秒/批`);
  
  // 性能评估
  console.log('\n========================================');
  console.log('性能评估');
  console.log('========================================');
  const throughput = totalEvents / duration;
  const successRate = (successCount / totalEvents) * 100;
  
  if (throughput > 1000 && successRate > 99) {
    console.log('✅ 性能优秀！');
  } else if (throughput > 500 && successRate > 95) {
    console.log('✅ 性能良好');
  } else if (successRate > 90) {
    console.log('⚠️  性能一般，建议优化');
  } else {
    console.log('❌ 性能较差，请检查配置');
  }
  
  console.log('\n💡 提示: 运行完整测试请使用: node test_sdk_comprehensive.js');
}

// 运行测试
quickTest().catch(error => {
  console.error('\n❌ 测试失败:', error.message);
  console.log('\n可能的原因:');
  console.log('  1. 后端服务未启动');
  console.log('  2. API地址不正确');
  console.log('  3. 项目ID不存在');
  console.log('  4. 网络连接问题');
  process.exit(1);
});
















