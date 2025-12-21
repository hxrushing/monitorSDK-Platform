/**
 * 行为探针
 * 自动PV上报、路由切换监听、停留时长、点击/曝光（可选）
 */

import { Probe, EventReporter } from '../../types/probes';
import { BehaviorProbeConfig } from '../../config';

/**
 * 行为探针实现
 */
export class BehaviorProbe implements Probe {
  public readonly name = 'behavior';
  public enabled: boolean = true;

  private reporter?: EventReporter;
  private config?: BehaviorProbeConfig;
  
  // 页面进入时间
  private pageEnterTime: number = Date.now();
  // 当前页面路径
  private currentPath: string = window.location.pathname;
  
  // 事件监听器
  private clickHandler?: (event: MouseEvent) => void;
  private visibilityChangeHandler?: () => void;
  private popstateHandler?: () => void;
  
  // 保存原始方法（用于监听pushState/replaceState）
  private originalPushState?: typeof history.pushState;
  private originalReplaceState?: typeof history.replaceState;

  constructor(config?: BehaviorProbeConfig) {
    this.config = config;
  }

  init(reporter: EventReporter): void {
    if (!this.enabled) return;
    this.reporter = reporter;

    // 自动PV上报
    if (this.config?.autoPV) {
      this.reportPageView();
    }

    // 自动路由切换监听
    if (this.config?.autoRoute) {
      this.initRouteListener();
    }

    // 点击事件采集（可选）
    if (this.config?.trackClick) {
      this.initClickTracking();
    }

    // 页面可见性变化监听（用于停留时长）
    this.initVisibilityTracking();
  }

  destroy(): void {
    // 移除事件监听器
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
    }

    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }

    // 恢复原始方法
    if (this.originalPushState && history.pushState !== this.originalPushState) {
      history.pushState = this.originalPushState;
    }

    if (this.originalReplaceState && history.replaceState !== this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
  }

  /**
   * 上报页面浏览
   */
  private reportPageView(): void {
    if (!this.reporter) return;

    const path = window.location.pathname;
    const referrer = document.referrer || undefined;

    this.reporter('page_view', {
      path,
      title: document.title,
      referrer,
      timestamp: Date.now(),
    }, 'normal');

    this.currentPath = path;
    this.pageEnterTime = Date.now();
  }

  /**
   * 初始化路由监听
   */
  private initRouteListener(): void {
    if (!this.reporter) return;

    const self = this;

    // 监听popstate（浏览器前进后退）
    this.popstateHandler = () => {
      self.handleRouteChange();
    };
    window.addEventListener('popstate', this.popstateHandler);

    // 拦截pushState和replaceState（SPA路由切换）
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      self.originalPushState!.apply(history, args);
      self.handleRouteChange();
    };

    history.replaceState = function(...args) {
      self.originalReplaceState!.apply(history, args);
      self.handleRouteChange();
    };

    // 监听hash变化（兼容hash路由）
    window.addEventListener('hashchange', () => {
      self.handleRouteChange();
    });
  }

  /**
   * 处理路由变化
   */
  private handleRouteChange(): void {
    const newPath = window.location.pathname + window.location.search + window.location.hash;
    
    // 如果路径没有变化，不重复上报
    if (newPath === this.currentPath) {
      return;
    }

    // 计算停留时长
    const stayDuration = Date.now() - this.pageEnterTime;

    // 上报上一个页面的停留时长
    if (this.reporter && this.currentPath) {
      this.reporter('page_view', {
        path: this.currentPath,
        stayDuration,
        action: 'leave',
      }, 'normal');
    }

    // 上报新页面
    this.reportPageView();
  }

  /**
   * 初始化点击事件追踪
   */
  private initClickTracking(): void {
    if (!this.reporter) return;

    const self = this;
    this.clickHandler = (event: MouseEvent) => {
      if (!self.reporter) return;
      
      const target = event.target as HTMLElement;
      
      // 获取元素信息
      const elementInfo = self.getElementInfo(target);

      self.reporter('click', {
        ...elementInfo,
        timestamp: Date.now(),
        page: window.location.pathname,
      }, 'low'); // 点击事件使用低优先级
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  /**
   * 获取元素信息
   */
  private getElementInfo(element: HTMLElement): Record<string, any> {
    const info: Record<string, any> = {
      tagName: element.tagName?.toLowerCase(),
    };

    // 获取ID
    if (element.id) {
      info.id = element.id;
    }

    // 获取类名
    if (element.className && typeof element.className === 'string') {
      info.className = element.className;
    }

    // 获取文本内容（截取前50个字符）
    const text = element.textContent?.trim();
    if (text) {
      info.text = text.substring(0, 50);
    }

    // 获取链接信息
    if (element.tagName === 'A') {
      const link = element as HTMLAnchorElement;
      info.href = link.href;
    }

    // 获取按钮信息
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      info.buttonText = text?.substring(0, 20);
    }

    return info;
  }

  /**
   * 初始化页面可见性追踪（用于停留时长计算）
   */
  private initVisibilityTracking(): void {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // 页面隐藏，记录隐藏时间
        // 可以在下次可见时计算隐藏时长
      } else {
        // 页面可见，更新进入时间（用于准确计算停留时长）
        // 注意：这里不重置pageEnterTime，因为我们想计算总的页面停留时长
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }
}

