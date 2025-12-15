import { useEffect, useRef, useState, useCallback } from 'react';

export interface WorkerMessage<T = any> {
  type: string;
  payload: T;
}

export interface WorkerResponse<R = any> {
  success: boolean;
  type?: string;
  result?: R;
  error?: string;
  stack?: string;
  originalLength?: number;
  sampledLength?: number;
}

export interface UseWorkerOptions {
  /**
   * Worker 初始化时的回调
   */
  onInit?: () => void;
  /**
   * Worker 错误时的回调
   */
  onError?: (error: Error) => void;
  /**
   * 是否自动终止 Worker（默认 true）
   */
  autoTerminate?: boolean;
}

/**
 * Web Worker Hook
 * 用于在后台线程中处理大数据，避免阻塞主线程
 * 
 * @param workerPath Worker 文件路径
 * @param onMessage 消息处理回调
 * @param options 配置选项
 * @returns Worker 控制方法
 * 
 * @example
 * ```typescript
 * const { postMessage, isProcessing, terminate } = useWorker(
 *   new URL('../workers/dataSampling.worker.ts', import.meta.url),
 *   (result) => {
 *     setSampledData(result);
 *   }
 * );
 * 
 * // 发送数据到 Worker 处理
 * postMessage({
 *   type: 'adaptive',
 *   payload: {
 *     data: largeDataArray,
 *     maxPoints: 1000,
 *     xField: 'date',
 *     yField: 'value',
 *     seriesField: 'type'
 *   }
 * });
 * ```
 */
export function useWorker<T = any, R = any>(
  workerPath: string | URL,
  onMessage?: (result: R, response: WorkerResponse<R>) => void,
  options: UseWorkerOptions = {}
): {
  postMessage: (message: WorkerMessage<T>) => void;
  isProcessing: boolean;
  terminate: () => void;
  worker: Worker | null;
} {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { onInit, onError, autoTerminate = true } = options;

  // 初始化 Worker
  useEffect(() => {
    try {
      // 创建 Worker
      // Vite 中需要使用 ?worker 后缀或 new URL 方式
      let workerUrl: string | URL;
      if (workerPath instanceof URL) {
        workerUrl = workerPath;
      } else if (typeof workerPath === 'string') {
        // 如果是字符串路径，转换为 URL
        workerUrl = new URL(workerPath, import.meta.url);
      } else {
        throw new Error('Invalid worker path');
      }
      
      workerRef.current = new Worker(workerUrl, {
        type: 'module'
      });

      // 监听 Worker 消息
      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse<R>>) => {
        setIsProcessing(false);
        
        if (event.data.success) {
          if (onMessage && event.data.result !== undefined) {
            onMessage(event.data.result, event.data);
          }
        } else {
          const error = new Error(event.data.error || 'Worker processing failed');
          if (event.data.stack) {
            error.stack = event.data.stack;
          }
          console.error('[Worker] 处理失败:', error);
          if (onError) {
            onError(error);
          }
        }
      };

      // 监听 Worker 错误
      workerRef.current.onerror = (error) => {
        setIsProcessing(false);
        console.error('[Worker] Worker 错误:', error);
        if (onError) {
          onError(new Error('Worker execution error'));
        }
      };

      if (onInit) {
        onInit();
      }

      if (import.meta.env.DEV) {
        console.log('[Worker] Worker 已初始化:', workerUrl);
      }
    } catch (error) {
      console.error('[Worker] 初始化失败:', error);
      setIsProcessing(false);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Worker initialization failed'));
      }
    }

    // 清理函数
    return () => {
      if (autoTerminate && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        if (import.meta.env.DEV) {
          console.log('[Worker] Worker 已终止');
        }
      }
    };
  }, [workerPath, onMessage, onError, onInit, autoTerminate]);

  // 发送消息到 Worker
  const postMessage = useCallback((message: WorkerMessage<T>) => {
    if (workerRef.current) {
      setIsProcessing(true);
      workerRef.current.postMessage(message);
      
      if (import.meta.env.DEV) {
        console.log('[Worker] 发送消息:', message.type, {
          dataLength: (message.payload as any)?.data?.length || 0
        });
      }
    } else {
      console.warn('[Worker] Worker 未初始化，无法发送消息');
    }
  }, []);

  // 手动终止 Worker
  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsProcessing(false);
      if (import.meta.env.DEV) {
        console.log('[Worker] Worker 已手动终止');
      }
    }
  }, []);

  return {
    postMessage,
    isProcessing,
    terminate,
    worker: workerRef.current
  };
}

/**
 * 数据采样 Worker Hook（便捷方法）
 * 专门用于数据采样场景
 */
export function useDataSamplingWorker<R = any>(
  onMessage?: (result: R) => void,
  options: UseWorkerOptions = {}
) {
  return useWorker(
    new URL('../workers/dataSampling.worker.ts', import.meta.url),
    (result, response) => {
      if (import.meta.env.DEV && response.originalLength && response.sampledLength) {
        console.log(
          `[Worker] 采样完成: ${response.originalLength} -> ${response.sampledLength} 点`,
          `压缩比: ${((1 - response.sampledLength / response.originalLength) * 100).toFixed(1)}%`
        );
      }
      onMessage?.(result);
    },
    options
  );
}

