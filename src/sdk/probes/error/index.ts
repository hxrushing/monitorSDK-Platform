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

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 监听全局错误
    this.errorHandler = (event: ErrorEvent) => {
      if (this.reporter) {
        this.reporter('error', {
          errorType: 'js',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          error: event.error?.toString(),
        }, 'high');
      }
    };
    window.addEventListener('error', this.errorHandler);

    // 监听未处理的Promise拒绝
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      if (this.reporter) {
        this.reporter('error', {
          errorType: 'promise',
          reason: event.reason?.toString(),
          stack: event.reason?.stack,
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
        
        if (this.reporter) {
          this.reporter('error', {
            errorType: 'resource',
            tagName: target.tagName,
            url,
            type: event.type,
          }, 'high');
        }
      }
    };
    window.addEventListener('error', this.resourceErrorHandler, true);

    // console.error 重写（可选，避免重复上报）
    // 注意：这里只是示例，实际使用时需要谨慎，避免影响调试
    // this.interceptConsole();
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

