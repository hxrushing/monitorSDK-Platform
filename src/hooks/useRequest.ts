import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';

export interface UseRequestOptions<T> {
  /** 是否手动触发（默认false，组件挂载时自动执行） */
  manual?: boolean;
  /** 请求成功回调 */
  onSuccess?: (data: T) => void;
  /** 请求失败回调 */
  onError?: (error: Error) => void;
  /** 是否显示错误提示（默认true） */
  showError?: boolean;
  /** 是否显示加载提示（默认false） */
  showLoading?: boolean;
  /** 请求去重，相同参数不重复请求 */
  dedupe?: boolean;
  /** 缓存时间（毫秒），0表示不缓存 */
  cacheTime?: number;
}

export interface UseRequestResult<T> {
  /** 数据 */
  data: T | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动触发请求 */
  run: (...args: any[]) => Promise<T | undefined>;
  /** 刷新数据（重新执行请求） */
  refresh: () => Promise<T | undefined>;
  /** 取消请求 */
  cancel: () => void;
}

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number; cacheTime: number }>();

/**
 * 请求Hook
 * 封装了常见的请求逻辑：加载状态、错误处理、缓存等
 */
export function useRequest<T = any>(
  requestFn: (...args: any[]) => Promise<T>,
  options: UseRequestOptions<T> = {}
): UseRequestResult<T> {
  const {
    manual = false,
    onSuccess,
    onError,
    showError = true,
    showLoading = false,
    dedupe = false,
    cacheTime = 0,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingRequestRef = useRef<Promise<T> | null>(null);
  const cacheKeyRef = useRef<string>('');

  // 生成缓存key
  const getCacheKey = useCallback((...args: any[]) => {
    return JSON.stringify(args);
  }, []);

  // 取消请求
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingRequestRef.current = null;
  }, []);

  // 执行请求
  const run = useCallback(async (...args: any[]): Promise<T | undefined> => {
    // 如果启用去重，检查是否有正在进行的相同请求
    if (dedupe && pendingRequestRef.current) {
      return pendingRequestRef.current as Promise<T>;
    }

    // 检查缓存
    const cacheKey = getCacheKey(...args);
    cacheKeyRef.current = cacheKey;
    
    if (cacheTime > 0) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.cacheTime) {
        setData(cached.data);
        return cached.data;
      }
    }

    // 取消之前的请求
    cancel();

    // 创建新的AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError(null);

      if (showLoading) {
        message.loading('加载中...', 0);
      }

      // 执行请求
      const requestPromise = requestFn(...args);
      pendingRequestRef.current = requestPromise;

      const result = await requestPromise;

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return undefined;
      }

      setData(result);
      
      // 缓存数据
      if (cacheTime > 0) {
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          cacheTime,
        });
      }

      onSuccess?.(result);
      
      if (showLoading) {
        message.destroy();
      }

      return result;
    } catch (err) {
      // 检查是否被取消
      if (abortController.signal.aborted) {
        return undefined;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      if (showError) {
        message.error(error.message || '请求失败');
      }

      onError?.(error);
      
      if (showLoading) {
        message.destroy();
      }

      throw error;
    } finally {
      setLoading(false);
      pendingRequestRef.current = null;
      abortControllerRef.current = null;
    }
  }, [requestFn, dedupe, cacheTime, getCacheKey, cancel, showError, showLoading, onSuccess, onError]);

  // 刷新数据
  const refresh = useCallback(() => {
    // 清除缓存
    if (cacheKeyRef.current) {
      cache.delete(cacheKeyRef.current);
    }
    return run();
  }, [run]);

  // 自动执行
  useEffect(() => {
    if (!manual) {
      run();
    }

    // 清理函数：组件卸载时取消请求
    return () => {
      cancel();
    };
  }, [manual]); // 注意：这里不包含run，避免无限循环

  return {
    data,
    loading,
    error,
    run,
    refresh,
    cancel,
  };
}

/**
 * 清除所有缓存
 */
export function clearRequestCache() {
  cache.clear();
}

/**
 * 清除指定key的缓存
 */
export function clearRequestCacheByKey(key: string) {
  cache.delete(key);
}

