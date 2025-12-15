/**
 * LRU (Least Recently Used) 缓存实现
 * 用于缓存热点查询结果，减少数据库压力
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number; // 缓存过期时间（毫秒），0表示不过期

  constructor(maxSize: number = 1000, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 获取缓存值
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问信息
    entry.lastAccess = Date.now();
    entry.accessCount++;

    // 移动到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: K, value: V): void {
    // 如果已存在，更新值
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.timestamp = Date.now();
      entry.lastAccess = Date.now();
      entry.accessCount++;
      
      // 移动到末尾
      this.cache.delete(key);
      this.cache.set(key, entry);
      return;
    }

    // 如果缓存已满，删除最久未使用的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      // 由于 Map 可能为空，先判断 firstKey 是否存在
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // 添加新项
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now()
    });
  }

  /**
   * 删除缓存项
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    // 清理过期项
    this.cleanExpired();
    return this.cache.size;
  }

  /**
   * 清理过期项
   */
  private cleanExpired(): void {
    if (this.ttl <= 0) {
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalAccess: number;
    avgAccessCount: number;
  } {
    this.cleanExpired();
    
    let totalAccess = 0;
    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
    }

    const avgAccessCount = this.cache.size > 0 
      ? totalAccess / this.cache.size 
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // 需要在外部统计
      totalAccess,
      avgAccessCount
    };
  }

  /**
   * 获取所有键
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * 获取所有值
   */
  values(): V[] {
    this.cleanExpired();
    return Array.from(this.cache.values()).map(entry => entry.value);
  }
}

/**
 * 缓存管理器
 * 管理多个缓存实例
 */
export class CacheManager {
  private caches: Map<string, LRUCache<any, any>>;

  constructor() {
    this.caches = new Map();
  }

  /**
   * 获取或创建缓存实例
   */
  getCache<TKey, TValue>(
    name: string,
    maxSize: number = 1000,
    ttl: number = 5 * 60 * 1000
  ): LRUCache<TKey, TValue> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache<TKey, TValue>(maxSize, ttl));
    }
    return this.caches.get(name) as LRUCache<TKey, TValue>;
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 清空指定缓存
   */
  clear(name: string): void {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * 获取所有缓存统计
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

// 全局缓存管理器实例
export const cacheManager = new CacheManager();






























