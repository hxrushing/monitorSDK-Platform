import React, { useEffect, useState } from 'react';
import { Card, Button, Space, message, Typography, Divider, Alert, Row, Col } from 'antd';
import { BugOutlined, PlayCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import AnalyticsSDK from '@/sdk';

const { Title, Text, Paragraph } = Typography;

const containerStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 120px)',
  padding: 24,
  background: 'linear-gradient(135deg, #f6f8fb 0%, #eef2f7 100%)'
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  padding: 28,
  border: '1px solid #eef0f3',
  marginBottom: 24
};

const SDKModule: React.FC = () => {
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [sdk, setSdk] = useState<AnalyticsSDK | null>(null);

  useEffect(() => {
    const sdkInstance = AnalyticsSDK.getInstance(
      'demo-project',
      (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api') + '/track'
    );
    sdkInstance.setUser('user-123');
    setSdk(sdkInstance);
    
    // 页面浏览事件
    sdkInstance.track('页面浏览', { 
      路径: location.pathname,
      模块: 'SDK模块演示'
    });
    
    addToLog('页面浏览事件已发送');
  }, []);

  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  // 点击事件模拟
  const handleClickEvent = (eventName: string, params: Record<string, any>) => {
    if (sdk) {
      sdk.trackUserAction(eventName, params);
      addToLog(`用户行为事件: ${eventName} - ${JSON.stringify(params)}`);
      message.success(`已发送用户行为事件: ${eventName}`);
    }
  };

  // 错误事件模拟
  const handleErrorEvent = (errorType: string) => {
    if (sdk) {
      const errorDetails = {
        错误描述: `模拟${errorType}错误`,
        用户操作: '手动触发',
        页面URL: window.location.href,
        用户代理: navigator.userAgent
      };
      
      sdk.trackError(errorType, errorDetails);
      addToLog(`错误事件: ${errorType} - ${JSON.stringify(errorDetails)}`);
      message.warning(`已发送错误事件: ${errorType}`);
    }
  };

  // 模拟JavaScript错误
  const simulateJSError = () => {
    try {
      // 故意触发一个错误
      (window as any).nonExistentFunction();
    } catch (error) {
      if (sdk) {
        sdk.track('error', {
          message: '模拟JavaScript错误',
          error: error instanceof Error ? error.stack : String(error),
          type: 'JavaScript Error',
          触发方式: '手动模拟'
        });
        addToLog('JavaScript错误已捕获并发送');
        message.error('已模拟并发送JavaScript错误');
      }
    }
  };

  // 模拟网络错误
  const simulateNetworkError = () => {
    if (sdk) {
      sdk.track('networkError', {
        错误类型: '网络请求失败',
        状态码: 500,
        请求URL: '/api/simulate-error',
        错误信息: 'Internal Server Error',
        发生时间: new Date().toISOString()
      });
      addToLog('网络错误事件已发送');
      message.error('已模拟网络错误事件');
    }
  };

  // 模拟Promise拒绝
  const simulatePromiseRejection = () => {
    // 创建一个会被拒绝的Promise
    Promise.reject(new Error('模拟Promise拒绝错误'))
      .catch(error => {
        if (sdk) {
          sdk.track('unhandledRejection', {
            reason: error.message,
            stack: error.stack,
            触发方式: '手动模拟'
          });
          addToLog('Promise拒绝错误已捕获并发送');
          message.error('已模拟Promise拒绝错误');
        }
      });
  };

  // 性能监控演示
  const simulatePerformanceEvent = () => {
    if (sdk) {
      const loadTime = Math.random() * 2000 + 500; // 模拟页面加载时间
      sdk.trackPerformance('页面加载时间', loadTime, 'ms');
      addToLog(`性能事件: 页面加载时间 - ${loadTime.toFixed(2)}ms`);
      message.info(`已发送性能事件: 页面加载时间 ${loadTime.toFixed(2)}ms`);
    }
  };

  return (
    <div style={containerStyle}>
      <Card style={cardStyle}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: '#1f2328' }}>
            <BugOutlined style={{ marginRight: 8, color: '#1f6feb' }} />
            SDK 模块演示
          </Title>
          <Paragraph style={{ color: '#57606a', marginTop: 8 }}>
            这个模块演示了SDK的各种事件跟踪功能，包括点击事件和错误事件模拟。
            所有事件都会实时发送到后端并显示在事件日志中。
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {/* 点击事件区域 */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <PlayCircleOutlined style={{ color: '#52c41a' }} />
                  <span>点击事件模拟</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  message="点击事件跟踪"
                  description="点击下方按钮可以模拟不同类型的用户点击事件"
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                />
                
                <Space wrap>
                  <Button 
                    type="primary" 
                    onClick={() => handleClickEvent('按钮点击', { 
                      按钮类型: '主要按钮',
                      按钮文本: '立即购买',
                      页面位置: '商品详情页'
                    })}
                  >
                    立即购买
                  </Button>
                  
                  <Button 
                    onClick={() => handleClickEvent('按钮点击', { 
                      按钮类型: '次要按钮',
                      按钮文本: '加入收藏',
                      页面位置: '商品详情页'
                    })}
                  >
                    加入收藏
                  </Button>
                  
                  <Button 
                    onClick={() => handleClickEvent('链接点击', { 
                      链接类型: '导航链接',
                      目标页面: '用户中心',
                      来源页面: 'SDK模块演示'
                    })}
                  >
                    用户中心
                  </Button>
                  
                  <Button 
                    onClick={() => handleClickEvent('表单提交', { 
                      表单类型: '用户反馈',
                      字段数量: 3,
                      提交时间: new Date().toISOString()
                    })}
                  >
                    提交反馈
                  </Button>
                  
                  <Button 
                    type="dashed"
                    onClick={() => simulatePerformanceEvent()}
                  >
                    性能监控
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>

          {/* 错误事件区域 */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>错误事件模拟</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  message="错误事件跟踪"
                  description="点击下方按钮可以模拟不同类型的错误事件"
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                />
                
                <Space wrap>
                  <Button 
                    danger
                    onClick={() => handleErrorEvent('业务逻辑错误')}
                  >
                    业务错误
                  </Button>
                  
                  <Button 
                    danger
                    onClick={() => simulateJSError()}
                  >
                    JS错误
                  </Button>
                  
                  <Button 
                    danger
                    onClick={() => simulateNetworkError()}
                  >
                    网络错误
                  </Button>
                  
                  <Button 
                    danger
                    onClick={() => simulatePromiseRejection()}
                  >
                    Promise拒绝
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* 事件日志 */}
        <Card 
          title={
            <Space>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <span>事件日志</span>
            </Space>
          }
        >
          <div style={{ 
            background: '#f8f9fa', 
            border: '1px solid #e9ecef', 
            borderRadius: 8, 
            padding: 16,
            minHeight: 200,
            maxHeight: 300,
            overflow: 'auto'
          }}>
            {eventLog.length === 0 ? (
              <Text type="secondary">暂无事件日志</Text>
            ) : (
              eventLog.map((log, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: '4px 0', 
                    borderBottom: index < eventLog.length - 1 ? '1px solid #e9ecef' : 'none',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </Card>
      </Card>
    </div>
  );
};

export default SDKModule;
