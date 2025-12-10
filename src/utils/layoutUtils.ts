/**
 * 布局工具函数
 * 用于优化布局属性读取，避免强制重排
 */

/**
 * 批量读取布局属性，减少强制重排次数
 * 在同一个函数调用中读取多个布局属性，浏览器会批量处理
 */
export function batchReadLayout<T>(
  elements: Array<{ element: HTMLElement | null; callback: (rect: DOMRect) => T }>
): Array<T | null> {
  // 强制同步布局，然后批量读取所有属性
  // 这样浏览器只需要进行一次布局计算
  const results: Array<T | null> = [];
  
  for (const { element, callback } of elements) {
    if (element) {
      const rect = element.getBoundingClientRect();
      results.push(callback(rect));
    } else {
      results.push(null);
    }
  }
  
  return results;
}

/**
 * 使用 requestAnimationFrame 节流的布局读取
 * 避免在频繁事件（如拖拽、滚动）中触发强制重排
 */
export function throttledReadLayout(
  element: HTMLElement | null,
  callback: (rect: DOMRect | null) => void,
  rafIdRef: { current: number | null }
): void {
  if (!element) {
    callback(null);
    return;
  }
  
  // 如果已有待处理的请求，取消它
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);
  }
  
  // 在下一帧读取布局
  rafIdRef.current = requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    callback(rect);
    rafIdRef.current = null;
  });
}

/**
 * 缓存布局信息，避免频繁读取
 */
export class LayoutCache {
  private cache: Map<HTMLElement, { rect: DOMRect; timestamp: number }> = new Map();
  private readonly maxAge: number; // 缓存有效期（毫秒）

  constructor(maxAge: number = 100) {
    this.maxAge = maxAge;
  }

  /**
   * 获取元素的布局信息（带缓存）
   */
  getBoundingClientRect(element: HTMLElement): DOMRect {
    const now = Date.now();
    const cached = this.cache.get(element);
    
    // 如果缓存有效，直接返回
    if (cached && (now - cached.timestamp) < this.maxAge) {
      return cached.rect;
    }
    
    // 读取新的布局信息
    const rect = element.getBoundingClientRect();
    this.cache.set(element, { rect, timestamp: now });
    
    return rect;
  }

  /**
   * 清除指定元素的缓存
   */
  invalidate(element: HTMLElement): void {
    this.cache.delete(element);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }
}

