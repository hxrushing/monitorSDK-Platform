import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Result, Button } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';

/**
 * 路由错误边界组件
 * 专门用于React Router v6的errorElement
 * 处理路由级别的错误（如加载器错误、路由错误等）
 */
const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  // 判断错误类型
  if (isRouteErrorResponse(error)) {
    // 路由错误（404、500等）
    if (error.status === 404) {
      return (
        <Result
          status="404"
          title="404"
          subTitle="抱歉，您访问的页面不存在。"
          extra={
            <Link to="/app/dashboard">
              <Button type="primary" icon={<HomeOutlined />}>
                返回首页
              </Button>
            </Link>
          }
        />
      );
    }

    if (error.status === 500) {
      return (
        <Result
          status="500"
          title="500"
          subTitle="服务器出现了错误，请稍后再试。"
          extra={[
            <Link to="/app/dashboard" key="home">
              <Button type="primary" icon={<HomeOutlined />}>
                返回首页
              </Button>
            </Link>,
            <Button
              key="reload"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>,
          ]}
        >
          {process.env.NODE_ENV === 'development' && error.data && (
            <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  错误详情（开发环境）
                </summary>
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {JSON.stringify(error.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </Result>
      );
    }

    // 其他HTTP错误
    return (
      <Result
        status="error"
        title={error.status}
        subTitle={error.statusText || '发生了错误'}
        extra={
          <Link to="/app/dashboard">
            <Button type="primary" icon={<HomeOutlined />}>
              返回首页
            </Button>
          </Link>
        }
      />
    );
  }

  // JavaScript错误或其他错误
  const errorMessage = error instanceof Error ? error.message : '发生了未知错误';

  return (
    <Result
      status="500"
      title="错误"
      subTitle={errorMessage}
      extra={[
        <Link to="/app/dashboard" key="home">
          <Button type="primary" icon={<HomeOutlined />}>
            返回首页
          </Button>
        </Link>,
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={() => window.location.reload()}
        >
          刷新页面
        </Button>,
      ]}
    >
      {process.env.NODE_ENV === 'development' && error instanceof Error && (
        <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              错误详情（开发环境）
            </summary>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error.stack || error.toString()}
            </pre>
          </details>
        </div>
      )}
    </Result>
  );
};

export default RouteErrorBoundary;

