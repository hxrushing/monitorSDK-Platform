import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * 错误边界组件
 * 捕获子组件树中的JavaScript错误，记录错误信息，并显示降级UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state，使下一次渲染能够显示降级后的UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误到错误报告服务
    console.error('ErrorBoundary捕获到错误:', error, errorInfo);
    
    // 这里可以发送错误到监控服务
    // errorReportingService.logError(error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  handleGoHome = () => {
    window.location.href = '/app/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <Result
          status="500"
          title="500"
          subTitle="抱歉，页面出现了错误。"
          extra={[
            <Button type="primary" key="home" icon={<HomeOutlined />} onClick={this.handleGoHome}>
              返回首页
            </Button>,
            <Button key="retry" onClick={this.handleReset}>
              重试
            </Button>,
          ]}
        >
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  错误详情（开发环境）
                </summary>
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>
          )}
        </Result>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

