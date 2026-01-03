/**
 * 错误探针
 * JS Error、Promise rejection、资源加载错误、console重写
 */

import { Probe, EventReporter } from '../../types/probes';

/**
 * 错误探针实现
 */
export class ErrorProbe implements Probe {
  public readonly name = 'error';
  public enabled: boolean = true;

  private reporter?: EventReporter;

  constructor() {
    // 构造函数不接收参数，reporter在init时传入
  }
  private originalConsoleError?: typeof console.error;
  private originalConsoleWarn?: typeof console.warn;
  private errorHandler?: (event: ErrorEvent) => void;
  private rejectionHandler?: (event: PromiseRejectionEvent) => void;
  private resourceErrorHandler?: (event: Event) => void;

  /**
   * 提取错误堆栈信息
   * @param error 错误对象（可能是Error、字符串、对象等）
   * @param fallbackMessage 当无法提取堆栈时的备用消息
   * @returns 规范化后的堆栈字符串
   */
  private extractErrorStack(error: any, fallbackMessage?: string): string {
    // 如果error是Error对象，直接返回stack
    if (error instanceof Error) {
      return error.stack || this.buildFallbackStack(error, fallbackMessage);
    }

    // 如果error有stack属性（可能是自定义错误对象）
    if (error && typeof error === 'object' && error.stack) {
      return String(error.stack);
    }

    // 如果error是字符串，尝试解析是否包含堆栈信息
    if (typeof error === 'string') {
      // 检查字符串是否包含堆栈格式（包含 "at " 关键字）
      if (error.includes(' at ') || error.includes('\n    at ')) {
        return error;
      }
      // 如果不包含堆栈，构建一个基础堆栈
      return this.buildFallbackStack(new Error(error), fallbackMessage);
    }

    // 尝试从error对象中提取信息
    if (error && typeof error === 'object') {
      try {
        // 尝试JSON序列化获取更多信息
        const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
        // 如果有stack字段
        const parsed = JSON.parse(errorStr);
        if (parsed.stack) {
          return String(parsed.stack);
        }
      } catch (e) {
        // JSON序列化失败，继续使用fallback
      }
      
      // 尝试toString方法
      if (error.toString && typeof error.toString === 'function') {
        const errorStr = error.toString();
        if (errorStr.includes(' at ') || errorStr.includes('\n    at ')) {
          return errorStr;
        }
      }
    }

    // 如果都没有，构建一个fallback堆栈
    return this.buildFallbackStack(error, fallbackMessage);
  }

  /**
   * 构建备用的堆栈信息
   * @param error 错误对象
   * @param fallbackMessage 备用消息
   * @returns 堆栈字符串
   */
  private buildFallbackStack(error: any, fallbackMessage?: string): string {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message || fallbackMessage || String(error);
    
    // 尝试从调用栈中提取信息（排除当前函数）
    try {
      const stack = new Error().stack;
      if (stack) {
        // 移除堆栈中的前几行（Error构造函数、buildFallbackStack、extractErrorStack）
        const lines = stack.split('\n');
        const relevantLines = lines.slice(4); // 跳过前4行
        return `${errorName}: ${errorMessage}\n${relevantLines.join('\n')}`;
      }
    } catch (e) {
      // 如果无法获取堆栈，返回基础信息
    }

    return `${errorName}: ${errorMessage}\n    at <unknown>`;
  }

  /**
   * 规范化堆栈信息
   * 移除敏感信息、限制长度、格式化
   * @param stack 原始堆栈字符串
   * @param maxLength 最大长度限制
   * @returns 规范化后的堆栈
   */
  private normalizeStack(stack: string | undefined, maxLength: number = 10000): string | undefined {
    if (!stack) return undefined;

    let normalized = stack;

    // 限制堆栈长度，避免过大的堆栈信息
    if (normalized.length > maxLength) {
      normalized = normalized.substring(0, maxLength) + '\n... (堆栈信息已截断)';
    }

    // 可选：移除敏感路径信息（根据需要启用）
    // normalized = normalized.replace(/file:\/\/\/[^\s]+/g, '<文件路径>');
    // normalized = normalized.replace(/C:\\[^\s]+/g, '<文件路径>');

    return normalized;
  }

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 监听全局错误
    this.errorHandler = (event: ErrorEvent) => {
      if (this.reporter) {
        const error = event.error;
        const stack = this.extractErrorStack(error, event.message);
        
        this.reporter('error', {
          errorType: 'js',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: this.normalizeStack(stack),
          error: error?.toString() || event.message,
          errorName: error?.name,
        }, 'high');
      }
    };
    window.addEventListener('error', this.errorHandler);

    // 监听未处理的Promise拒绝
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      if (this.reporter) {
        const reason = event.reason;
        const stack = this.extractErrorStack(reason);
        
        this.reporter('error', {
          errorType: 'promise',
          reason: reason?.toString() || String(reason),
          stack: this.normalizeStack(stack),
          errorName: reason?.name,
        }, 'high');
      }
    };
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    // 监听资源加载错误
    this.resourceErrorHandler = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const url = (target as HTMLImageElement).src || 
                    (target as HTMLScriptElement).src || 
                    (target as HTMLLinkElement).href;
        
        // 资源加载错误通常没有堆栈，但我们尝试构建一个基础堆栈信息
        const errorMessage = `资源加载失败: ${url}`;
        const stack = this.buildFallbackStack(new Error(errorMessage), errorMessage);
        
        if (this.reporter) {
          this.reporter('error', {
            errorType: 'resource',
            tagName: target.tagName,
            url,
            type: event.type,
            message: `资源加载失败: ${target.tagName}`,
            stack: this.normalizeStack(stack),
          }, 'high');
        }
      }
    };
    window.addEventListener('error', this.resourceErrorHandler, true);

    // console.error 重写（捕捉console.error中的错误堆栈）
    this.interceptConsole();
  }

  /**
   * 拦截console.error和console.warn以捕捉错误堆栈
   */
  private interceptConsole(): void {
    if (typeof console === 'undefined') return;

    // 保存原始方法
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    // 重写console.error
    console.error = (...args: any[]) => {
      // 调用原始方法
      if (this.originalConsoleError) {
        this.originalConsoleError.apply(console, args);
      }

      // 尝试从参数中提取错误信息
      args.forEach((arg) => {
        if (arg instanceof Error || (arg && typeof arg === 'object' && arg.stack)) {
          const stack = this.extractErrorStack(arg);
          if (this.reporter) {
            this.reporter('error', {
              errorType: 'console',
              message: arg instanceof Error ? arg.message : String(arg),
              stack: this.normalizeStack(stack),
              errorName: arg?.name,
              source: 'console.error',
            }, 'normal');
          }
        }
      });
    };

    // 重写console.warn（可选，通常warn不会上报，但可以记录）
    console.warn = (...args: any[]) => {
      // 调用原始方法
      if (this.originalConsoleWarn) {
        this.originalConsoleWarn.apply(console, args);
      }

      // warn通常不上报，但可以在这里添加日志记录逻辑
      // 如果需要上报warn，可以取消注释下面的代码
      /*
      args.forEach((arg) => {
        if (arg instanceof Error || (arg && typeof arg === 'object' && arg.stack)) {
          const stack = this.extractErrorStack(arg);
          if (this.reporter) {
            this.reporter('error', {
              errorType: 'console',
              message: arg instanceof Error ? arg.message : String(arg),
              stack: this.normalizeStack(stack),
              errorName: arg?.name,
              source: 'console.warn',
            }, 'low');
          }
        }
      });
      */
    };
  }

  destroy(): void {
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    }
    if (this.resourceErrorHandler) {
      window.removeEventListener('error', this.resourceErrorHandler, true);
    }
    this.restoreConsole();
  }


  /**
   * 恢复console
   */
  private restoreConsole(): void {
    if (this.originalConsoleError && typeof console !== 'undefined') {
      console.error = this.originalConsoleError;
    }
    if (this.originalConsoleWarn && typeof console !== 'undefined') {
      console.warn = this.originalConsoleWarn;
    }
  }
}

