/**
 * HTTP探针
 * XHR/Fetch拦截，采集URL、method、status、duration、body/resp体积
 * 支持白名单/忽略与脱敏字段
 */

import { Probe, EventReporter } from '../../types/probes';
import { HttpProbeConfig } from '../../config';
import { maskSensitiveData, shouldIgnoreUrl } from '../../config';

/**
 * HTTP探针实现
 */
export class HttpProbe implements Probe {
  public readonly name = 'http';
  public enabled: boolean = true;

  private reporter?: EventReporter;
  private config?: HttpProbeConfig;
  
  // 保存原始方法
  private originalFetch?: typeof fetch;
  private originalXHROpen?: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend?: typeof XMLHttpRequest.prototype.send;
  
  // XHR请求追踪
  private xhrRequestMap: Map<XMLHttpRequest, {
    url: string;
    method: string;
    startTime: number;
    requestBody?: any;
  }> = new Map();

  constructor(config?: HttpProbeConfig) {
    this.config = config;
  }

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 拦截Fetch
    this.interceptFetch();
    
    // 拦截XHR
    this.interceptXHR();
  }

  destroy(): void {
    // 恢复原始方法
    if (this.originalFetch && window.fetch !== this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    if (this.originalXHROpen && XMLHttpRequest.prototype.open !== this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
    }
    
    if (this.originalXHRSend && XMLHttpRequest.prototype.send !== this.originalXHRSend) {
      XMLHttpRequest.prototype.send = this.originalXHRSend;
    }
    
    this.xhrRequestMap.clear();
  }

  /**
   * 拦截Fetch API
   */
  private interceptFetch(): void {
    if (!this.reporter) return;

    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || (typeof input !== 'string' && 'method' in input ? input.method : 'GET');
      
      // 检查是否需要忽略
      if (self.config && shouldIgnoreUrl(url, self.config.ignoreUrls)) {
        return self.originalFetch!.call(window, input, init);
      }

      const startTime = performance.now();
      let requestSize = 0;
      let responseSize = 0;
      let requestBody: any = null;
      let requestHeaders: Record<string, string> = {};
      let responseHeaders: Record<string, string> = {};

      // 处理请求体
      if (init?.body) {
        if (typeof init.body === 'string') {
          requestBody = init.body;
          requestSize = new Blob([init.body]).size;
        } else if (init.body instanceof FormData) {
          // FormData无法直接获取大小，使用估算
          requestBody = '[FormData]';
        } else if (init.body instanceof Blob) {
          requestSize = init.body.size;
          requestBody = '[Blob]';
        } else {
          requestBody = init.body;
        }
      }

      // 处理请求头
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            requestHeaders[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            requestHeaders[key] = value;
          });
        } else {
          requestHeaders = { ...init.headers } as Record<string, string>;
        }
        
        // 脱敏处理
        if (self.config?.maskHeaders) {
          requestHeaders = maskSensitiveData(requestHeaders, self.config.maskHeaders);
        }
      }

      try {
        const response = await self.originalFetch!.call(window, input, init);
        const duration = performance.now() - startTime;

        // 处理响应头
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // 处理响应体大小
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseSize = parseInt(contentLength, 10);
        } else {
          // 如果没有content-length，克隆响应来获取大小
          const clonedResponse = response.clone();
          try {
            const blob = await clonedResponse.blob();
            responseSize = blob.size;
          } catch (e) {
            // 忽略错误
          }
        }

        // 检查是否需要包含请求/响应体
        if (self.config) {
          if (!self.config.includeRequestBody || (self.config.maxBodySize && requestSize > self.config.maxBodySize)) {
            requestBody = undefined;
          }
          if (!self.config.includeResponseBody || (self.config.maxBodySize && responseSize > self.config.maxBodySize)) {
            // 不记录响应体
          }
          
          // 请求体脱敏
          if (requestBody && typeof requestBody === 'object' && self.config.maskBodyKeys && self.config.maskBodyKeys.length > 0) {
            requestBody = maskSensitiveData(requestBody, self.config.maskBodyKeys);
          }
        }

        // 上报HTTP事件
        if (self.reporter) {
          self.reporter('http', {
            url,
            method,
            status: response.status,
            duration: Math.round(duration),
            requestSize,
            responseSize,
            requestHeaders: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
            responseHeaders: Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
            requestBody: self.config?.includeRequestBody ? requestBody : undefined,
          }, 'normal');
        }

        return response;
      } catch (error: any) {
        const duration = performance.now() - startTime;
        
        // 上报失败请求
        if (self.reporter) {
          self.reporter('http', {
            url,
            method,
            status: 0, // 网络错误
            duration: Math.round(duration),
            requestSize,
            responseSize: 0,
            error: error.message,
          }, 'normal');
        }

        throw error;
      }
    };
  }

  /**
   * 拦截XMLHttpRequest
   */
  private interceptXHR(): void {
    if (!this.reporter) return;

    const self = this;
    
    // 保存原始方法
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;

    // 拦截open方法
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const urlString = typeof url === 'string' ? url : url.href;
      
      // 检查是否需要忽略
      if (!self.config || !shouldIgnoreUrl(urlString, self.config.ignoreUrls)) {
        // 保存请求信息
        self.xhrRequestMap.set(this, {
          url: urlString,
          method: method.toUpperCase(),
          startTime: performance.now(),
        });
      }

      // 调用原始方法
      return self.originalXHROpen!.call(
        this,
        method,
        url,
        async !== undefined ? async : true,
        username,
        password
      );
    };

    // 拦截send方法
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const requestInfo = self.xhrRequestMap.get(this);
      
      if (requestInfo) {
        // 保存请求体
        if (body) {
          if (typeof body === 'string') {
            requestInfo.requestBody = body;
          } else if (body instanceof FormData) {
            requestInfo.requestBody = '[FormData]';
          } else if (body instanceof Blob) {
            requestInfo.requestBody = '[Blob]';
          } else {
            requestInfo.requestBody = body;
          }
        }

        // 监听状态变化
        const originalOnReadyStateChange = this.onreadystatechange;
        this.onreadystatechange = function(event) {
          // 调用原始回调
          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(this, event);
          }

          // 请求完成时上报
          if (this.readyState === XMLHttpRequest.DONE) {
            const duration = performance.now() - requestInfo.startTime;
            const status = this.status;
            const statusText = this.statusText;

            let requestSize = 0;
            let responseSize = 0;
            let requestHeaders: Record<string, string> = {};
            let responseHeaders: Record<string, string> = {};

            // 获取请求头大小
            if (requestInfo.requestBody) {
              if (typeof requestInfo.requestBody === 'string') {
                requestSize = new Blob([requestInfo.requestBody]).size;
              } else if (requestInfo.requestBody instanceof Blob) {
                requestSize = requestInfo.requestBody.size;
              }
            }

            // 获取响应大小
            const contentLength = this.getResponseHeader('content-length');
            if (contentLength) {
              responseSize = parseInt(contentLength, 10);
            } else if (this.responseText) {
              responseSize = new Blob([this.responseText]).size;
            }

            // 注意：XHR无法读取已设置的请求头，浏览器出于安全考虑不允许
            // 这里只记录响应头，请求头无法获取

            // 获取响应头
            const allResponseHeaders = this.getAllResponseHeaders();
            if (allResponseHeaders) {
              allResponseHeaders.split('\r\n').forEach(line => {
                const [key, value] = line.split(': ');
                if (key && value) {
                  responseHeaders[key.toLowerCase()] = value;
                }
              });
            }

            // 脱敏处理
            if (self.config) {
              if (self.config.maskHeaders && self.config.maskHeaders.length > 0) {
                requestHeaders = maskSensitiveData(requestHeaders, self.config.maskHeaders);
              }
              
              if (requestInfo.requestBody && typeof requestInfo.requestBody === 'object' && self.config.maskBodyKeys && self.config.maskBodyKeys.length > 0) {
                requestInfo.requestBody = maskSensitiveData(requestInfo.requestBody, self.config.maskBodyKeys);
              }
            }

            // 上报
            if (self.reporter) {
              self.reporter('http', {
                url: requestInfo.url,
                method: requestInfo.method,
                status,
                duration: Math.round(duration),
                requestSize,
                responseSize,
                requestHeaders: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                responseHeaders: Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
                requestBody: self.config?.includeRequestBody ? requestInfo.requestBody : undefined,
                statusText: statusText || undefined,
              }, 'normal');
            }

            // 清理
            self.xhrRequestMap.delete(this);
          }
        };
      }

      // 调用原始方法
      return self.originalXHRSend!.call(this, body);
    };
  }
}

