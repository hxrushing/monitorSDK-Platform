/**
 * 浏览器兼容的 UUID 生成工具
 * 优先使用浏览器原生 crypto.randomUUID()，否则使用 fallback 实现
 */

/**
 * 生成 UUID v4
 * 优先使用浏览器原生 API，否则使用兼容实现
 */
export function generateUUID(): string {
  // 优先使用浏览器原生 API（现代浏览器支持）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // 如果调用失败，使用 fallback
    }
  }

  // Fallback: 使用兼容实现
  return generateUUIDFallback();
}

/**
 * UUID v4 的兼容实现
 * 使用 crypto.getRandomValues() 生成随机数
 */
function generateUUIDFallback(): string {
  // 使用 crypto.getRandomValues 生成 16 字节随机数
  const bytes = new Uint8Array(16);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // 最后的 fallback：使用 Math.random()（不推荐，但作为兜底）
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // 设置版本号（第 13 位为 4）
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // 设置变体（第 17 位为 8, 9, A, 或 B）
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // 转换为 UUID 字符串格式
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

