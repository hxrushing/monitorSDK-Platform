import { v4 as uuidv4 } from 'uuid';

interface TrackEvent {
  eventName: string;
  eventParams?: Record<string, any>;
  timestamp: number;
}

interface CommonParams {
  uid?: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
  sdkVersion: string;
}

class AnalyticsSDK {
  private static instances: Map<string, AnalyticsSDK> = new Map();
  private commonParams: CommonParams;
  private endpoint: string;
  private projectId: string;

  private constructor(projectId: string, endpoint: string) {
    this.projectId = projectId;
    this.endpoint = endpoint;
    this.commonParams = {
      deviceInfo: this.getDeviceInfo(),
      sdkVersion: '1.0.0'
    };

    this.initErrorCapture();
  }

  public static getInstance(projectId: string, endpoint: string): AnalyticsSDK {
    const key = `${projectId}-${endpoint}`;
    if (!AnalyticsSDK.instances.has(key)) {
      AnalyticsSDK.instances.set(key, new AnalyticsSDK(projectId, endpoint));
    }
    return AnalyticsSDK.instances.get(key)!;
  }

  // 清理指定项目的SDK实例
  public static clearInstance(projectId: string, endpoint: string): void {
    const key = `${projectId}-${endpoint}`;
    AnalyticsSDK.instances.delete(key);
  }

  // 清理所有SDK实例
  public static clearAllInstances(): void {
    AnalyticsSDK.instances.clear();
  }

  // 获取当前实例的项目ID
  public getProjectId(): string {
    return this.projectId;
  }

  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  public setUser(uid: string) {
    this.commonParams.uid = uid;
  }

  public track(eventName: string, eventParams?: Record<string, any>) {
    const event: TrackEvent = {
      eventName,
      eventParams,
      timestamp: Date.now(),
    };

    this.send({
      ...event,
      projectId: this.projectId,
      ...this.commonParams,
    });
  }

  // 专门用于错误事件的方法
  public trackError(errorType: string, errorDetails: Record<string, any>) {
    this.track('error', {
      错误类型: errorType,
      ...errorDetails,
      发生时间: new Date().toISOString()
    });
  }

  // 专门用于用户行为事件的方法
  public trackUserAction(action: string, actionDetails: Record<string, any>) {
    this.track('userAction', {
      用户行为: action,
      ...actionDetails,
      行为时间: new Date().toISOString()
    });
  }


  private async send(data: any) {
    try {
      console.log('SDK发送事件数据:', data);
      console.log('发送到端点:', this.endpoint);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('服务器响应错误:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      console.log('事件发送成功');
    } catch (error) {
      console.error('Analytics tracking failed:', error);
      // 在开发环境下显示更详细的错误信息
      if (import.meta.env.DEV) {
        console.error('SDK发送失败详情:', {
          endpoint: this.endpoint,
          data: data,
          error: error
        });
      }
    }
  }

  private initErrorCapture() {
    window.addEventListener('error', (event) => {
      this.track('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('unhandledRejection', {
        reason: event.reason,
      });
    });
  }
}

export default AnalyticsSDK; 