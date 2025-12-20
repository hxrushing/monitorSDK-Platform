// SDK批量发送使用示例

import AnalyticsSDK from './index';

// 1. 基本使用 - 使用默认配置
const sdk = AnalyticsSDK.getInstance('your-project-id', '/api/track');

// 2. 自定义配置使用
const customSdk = AnalyticsSDK.getInstance('your-project-id', '/api/track', {
  maxBatchSize: 20,        // 最大批量20个事件
  flushInterval: 3000,      // 3秒刷新一次
  maxRetries: 5,           // 最大重试5次
  retryDelay: 2000,        // 重试延迟2秒
  enableOfflineStorage: true, // 启用离线存储
  maxStorageSize: 2 * 1024 * 1024, // 最大存储2MB
});

// 3. 设置用户ID
sdk.setUser('user-123');

// 4. 发送普通事件（普通优先级）
sdk.track('page_view', {
  page: '/home',
  referrer: 'https://google.com'
});

// 5. 发送高优先级事件（错误事件）
sdk.trackError('JavaScript Error', {
  message: 'Cannot read property of undefined',
  stack: 'Error stack trace...',
  url: window.location.href
});

// 6. 发送用户行为事件
sdk.trackUserAction('button_click', {
  buttonId: 'submit-btn',
  formId: 'contact-form'
});

// 7. 手动刷新队列（立即发送所有待发送事件）
sdk.flush().then(() => {
  console.log('所有事件已发送');
});

// 8. 获取队列状态
const status = sdk.getQueueStatus();
console.log('队列状态:', status);
// 输出: { queueLength: 5, isOnline: true, config: {...} }

// 9. 动态更新配置
sdk.updateBatchConfig({
  flushInterval: 10000, // 改为10秒刷新一次
  maxBatchSize: 100     // 改为最大100个事件
});

// 10. 模拟大量事件发送（测试批量发送效果）
for (let i = 0; i < 100; i++) {
  sdk.track('test_event', {
    index: i,
    timestamp: Date.now()
  });
}

// 11. 监听网络状态变化
window.addEventListener('online', () => {
  console.log('网络已连接，SDK将自动发送离线事件');
});

window.addEventListener('offline', () => {
  console.log('网络已断开，事件将存储到本地');
});

// 12. 页面卸载时确保事件发送
window.addEventListener('beforeunload', () => {
  // SDK会自动在页面卸载时发送剩余事件
  console.log('页面即将卸载，SDK正在发送剩余事件...');
});

export { sdk, customSdk };
