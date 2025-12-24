import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Typography, Alert, Breadcrumb, Tag, Space, Row, Col, message, Tabs, Button, Collapse, Table, Descriptions, Divider, Steps } from 'antd';
import { HomeOutlined, CopyOutlined, CodeOutlined, GlobalOutlined, SettingOutlined, PlayCircleOutlined, CheckCircleFilled, CloseCircleOutlined, InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import useGlobalStore from '@/store/globalStore';
import { apiService } from '@/services/api';
import type { EventDefinition } from '@/types';
import { init, type SDKInstance } from '@/sdk';

const { Title, Paragraph, Text } = Typography;

/**
 * 接入步骤页面组件
 * 包含步骤一到步骤四的详细内容
 */
const IntegrationSteps: React.FC = () => {
  const navigate = useNavigate();
  
  // 从路由参数获取 projectId
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  
  // 从全局状态获取 projectId（作为备选）
  const globalProjectId = useGlobalStore(state => state.selectedProjectId);
  
  // 优先使用路由参数，如果没有则使用全局状态
  const projectId = routeProjectId || globalProjectId;

  // 事件定义列表
  const [eventDefinitions, setEventDefinitions] = React.useState<EventDefinition[]>([]);
  const [loadingEvents, setLoadingEvents] = React.useState(false);
  
  // 测试相关状态
  const [testSdk, setTestSdk] = React.useState<SDKInstance | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // 生成上报地址
  const getEndpoint = React.useCallback(() => {
    const origin = window.location.origin;
    return `${origin}/api/track`;
  }, []);

  const endpoint = getEndpoint();

  // 获取事件定义列表
  const fetchEventDefinitions = React.useCallback(async (projectId: string) => {
    try {
      setLoadingEvents(true);
      const events = await apiService.getEventDefinitions(projectId);
      setEventDefinitions(events);
    } catch (err: any) {
      console.log('获取事件定义失败:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // 初始化测试 SDK
  React.useEffect(() => {
    if (projectId) {
      const endpointUrl = getEndpoint();
      try {
        const sdkInstance = init({
          projectId,
          endpoint: endpointUrl,
          enable: {
            error: false,
            http: false,
            perf: false,
            behavior: false,
            blankScreen: false,
          },
          debug: true,
        });
        setTestSdk(sdkInstance);
      } catch (err: any) {
        console.error('初始化测试 SDK 失败:', err);
        message.error('初始化测试 SDK 失败');
      }
    }
  }, [projectId, getEndpoint]);

  // 发送测试事件
  const handleSendTestEvent = React.useCallback(async () => {
    if (!testSdk || !projectId) {
      message.warning('SDK 未初始化，请稍候再试');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testEventName = 'integration_test';
      const testEventParams = {
        test_type: 'integration_guide',
        test_time: new Date().toISOString(),
        test_source: 'integration_guide_page',
        project_id: projectId,
      };

      testSdk.track(testEventName, testEventParams, 'high');
      await testSdk.flush();

      setTestResult({
        success: true,
        message: '测试事件发送成功！',
        details: `事件名称: ${testEventName}\n事件参数: ${JSON.stringify(testEventParams, null, 2)}`,
      });

      message.success('测试事件已发送，请前往事件页面验证');
    } catch (err: any) {
      console.error('发送测试事件失败:', err);
      setTestResult({
        success: false,
        message: '测试事件发送失败',
        details: err?.message || '未知错误',
      });
      message.error(`发送失败: ${err?.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  }, [testSdk, projectId]);

  // 获取事件定义
  React.useEffect(() => {
    if (projectId) {
      fetchEventDefinitions(projectId);
    }
  }, [projectId, fetchEventDefinitions]);

  // 获取主题模式
  const themeMode = useGlobalStore(state => state.themeMode);
  const isDark = themeMode === 'dark';

  // 代码块组件
  const CodeBlock: React.FC<{ code: string; onCopy?: () => void }> = ({ code, onCopy }) => {
    return (
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div
          style={{
            padding: '12px 16px',
            background: isDark ? '#1f1f1f' : '#f5f5f5',
            color: isDark ? '#d4d4d4' : '#333',
            borderRadius: '6px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
            fontSize: '13px',
            lineHeight: '1.6',
            overflowX: 'auto',
            whiteSpace: 'pre',
            position: 'relative',
            border: isDark ? '1px solid #303030' : '1px solid #e8e8e8',
            WebkitOverflowScrolling: 'touch',
            maxWidth: '100%',
          }}
        >
          <code style={{ 
            color: 'inherit',
            whiteSpace: 'pre',
            wordBreak: 'normal',
            overflowWrap: 'normal',
          }}>{code}</code>
        </div>
        {onCopy && (
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={onCopy}
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: '#1890ff',
              minWidth: '44px',
              minHeight: '44px',
              padding: '8px',
            }}
          >
            复制
          </Button>
        )}
      </div>
    );
  };

  // 复制功能
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${label}已复制到剪贴板`);
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  // SDK 初始化代码生成器
  const generateInitCode = React.useCallback((framework: 'react' | 'vue' | 'vanilla') => {
    const baseCode = {
      react: `import { init } from './sdk';
import { useEffect } from 'react';

// 在应用入口或根组件中初始化
function App() {
  useEffect(() => {
    const sdk = init({
      projectId: '${projectId}',
      endpoint: '${endpoint}',
      // 可选配置
      enable: {
        error: true,    // 错误监控
        http: true,     // HTTP监控
        perf: true,     // 性能监控
        behavior: true, // 行为监控
      },
    });

    // 设置用户ID（可选）
    // sdk.setUser('user-123');

    // 返回清理函数
    return () => {
      // SDK 会在页面卸载时自动发送剩余事件
    };
  }, []);

  return <div>Your App</div>;
}`,
      vue: `import { init } from './sdk';
import { onMounted, onUnmounted } from 'vue';

// 在应用入口或根组件中初始化
export default {
  setup() {
    let sdk: any = null;

    onMounted(() => {
      sdk = init({
        projectId: '${projectId}',
        endpoint: '${endpoint}',
        // 可选配置
        enable: {
          error: true,    // 错误监控
          http: true,     // HTTP监控
          perf: true,     // 性能监控
          behavior: true, // 行为监控
        },
      });

      // 设置用户ID（可选）
      // sdk.setUser('user-123');
    });

    onUnmounted(() => {
      // SDK 会在页面卸载时自动发送剩余事件
    });
  }
}`,
      vanilla: `// 方式1: ES6 模块引入
import { init } from './sdk';

const sdk = init({
  projectId: '${projectId}',
  endpoint: '${endpoint}',
  // 可选配置
  enable: {
    error: true,    // 错误监控
    http: true,     // HTTP监控
    perf: true,     // 性能监控
    behavior: true, // 行为监控
  },
});

// 设置用户ID（可选）
// sdk.setUser('user-123');

// 方式2: Script 标签引入（见下方）`
    };

    return baseCode[framework];
  }, [projectId, endpoint]);

  // Script 标签引入代码
  const scriptTagCode = React.useMemo(() => {
    return `<!-- 在 HTML 中引入 SDK -->
<script src="./sdk/index.js"></script>

<script>
  // 初始化 SDK
  const sdk = window.Analytics.init({
    projectId: '${projectId}',
    endpoint: '${endpoint}',
    // 可选配置
    enable: {
      error: true,    // 错误监控
      http: true,     // HTTP监控
      perf: true,     // 性能监控
      behavior: true, // 行为监控
    },
  });

  // 设置用户ID（可选）
  // sdk.setUser('user-123');
</script>`;
  }, [projectId, endpoint]);

  // 面包屑
  const breadcrumbItems = [
    {
      title: <Link to="/app/dashboard"><HomeOutlined /></Link>,
    },
    {
      title: <Link to={`/app/integration/${projectId}`}>接入指引</Link>,
    },
    {
      title: '接入步骤',
    },
  ];

  if (!projectId) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Alert
          message="缺少项目 ID"
          description="请先选择项目或通过正确的链接访问此页面。"
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={() => navigate('/app/dashboard')}>
              返回首页
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '24px 16px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      minHeight: '100vh'
    }}>
      <Breadcrumb 
        items={breadcrumbItems} 
        style={{ marginBottom: 24 }} 
      />

      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/app/integration/${projectId}`)}
        style={{ marginBottom: 16 }}
      >
        返回接入指引
      </Button>

      {/* 步骤 1: SDK 引入方式 */}
      <Card 
        style={{ 
          marginTop: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '8px'
        }}
      >
        <Title level={4}>步骤 1：引入 SDK</Title>
        <Paragraph>
          选择适合您项目的引入方式。推荐使用 ES6 模块引入，便于代码管理和构建优化。
        </Paragraph>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* ES6 模块引入 */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <CodeOutlined />
                  <span>ES6 模块引入（推荐）</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>在代码中引入</Text>
                  <CodeBlock
                    code={`import { init } from './sdk';`}
                    onCopy={() => handleCopy("import { init } from './sdk';", '引入代码')}
                  />
                </div>

                <Alert
                  message="优势"
                  description="支持 TypeScript 类型提示、Tree-shaking 优化、便于代码管理，适合使用构建工具的项目。"
                  type="success"
                  showIcon
                  style={{ fontSize: '12px' }}
                />
              </Space>
            </Card>
          </Col>

          {/* Script 标签引入 */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <GlobalOutlined />
                  <span>Script 标签引入</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>在 HTML 中引入</Text>
                  <CodeBlock
                    code={`<script src="./sdk/index.js"></script>`}
                    onCopy={() => handleCopy('<script src="./sdk/index.js"></script>', 'Script 标签')}
                  />
                </div>

                <Alert
                  message="注意"
                  description={
                    <div>
                      <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                        • 需要将 SDK 文件复制到项目目录
                      </Paragraph>
                      <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                        • 适合不使用构建工具的项目
                      </Paragraph>
                      <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                        • SDK 会挂载到 window.Analytics
                      </Paragraph>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ fontSize: '12px' }}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 步骤 2: SDK 初始化代码 */}
      <Card 
        style={{ 
          marginTop: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '8px'
        }}
      >
        <Title level={4}>步骤 2：初始化 SDK</Title>
        <Paragraph>
          根据您使用的框架，选择对应的初始化代码。代码已自动填充当前项目的 <Text code>projectId</Text> 和 <Text code>endpoint</Text>。
        </Paragraph>

        <Tabs
          defaultActiveKey="react"
          items={[
            {
              key: 'react',
              label: 'React',
              children: (
                <div>
                  <CodeBlock
                    code={generateInitCode('react')}
                    onCopy={() => handleCopy(generateInitCode('react'), 'React 初始化代码')}
                  />
                </div>
              ),
            },
            {
              key: 'vue',
              label: 'Vue',
              children: (
                <div>
                  <CodeBlock
                    code={generateInitCode('vue')}
                    onCopy={() => handleCopy(generateInitCode('vue'), 'Vue 初始化代码')}
                  />
                </div>
              ),
            },
            {
              key: 'vanilla',
              label: '原生 JavaScript',
              children: (
                <div>
                  <CodeBlock
                    code={generateInitCode('vanilla')}
                    onCopy={() => handleCopy(generateInitCode('vanilla'), '原生 JS 初始化代码')}
                  />
                </div>
              ),
            },
            {
              key: 'script',
              label: 'Script 标签方式',
              children: (
                <div>
                  <CodeBlock
                    code={scriptTagCode}
                    onCopy={() => handleCopy(scriptTagCode, 'Script 标签代码')}
                  />
                </div>
              ),
            },
          ]}
          style={{ marginTop: 16 }}
        />

        <Alert
          message="配置说明"
          description={
            <div>
              <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                • <Text code>projectId</Text>: 当前项目的唯一标识，已自动填充
              </Paragraph>
              <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                • <Text code>endpoint</Text>: 数据上报地址，已自动填充
              </Paragraph>
              <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                • <Text code>enable</Text>: 探针开关配置，可根据需要开启/关闭
              </Paragraph>
              <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                • 更多配置选项请参考 SDK 文档
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16, fontSize: '12px' }}
        />
      </Card>

      {/* 步骤 3: 埋点示例代码 */}
      <Card 
        style={{ 
          marginTop: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '8px'
        }}
      >
        <Title level={4}>步骤 3：埋点示例代码</Title>
        <Paragraph>
          以下是常用的埋点场景示例。您可以根据业务需求，参考这些示例进行埋点。
        </Paragraph>

        <Collapse
          items={[
            {
              key: 'page_view',
              label: (
                <Space>
                  <Text strong>页面浏览事件（page_view）</Text>
                  <Tag color="blue">常用</Tag>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text type="secondary">事件说明：</Text> 用于追踪用户访问的页面，通常在页面加载时触发。
                  </Paragraph>
                  <Paragraph>
                    <Text type="secondary">使用场景：</Text> 页面加载、路由切换、单页应用页面切换
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <CodeBlock
                    code={`// React 示例
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();
  
  useEffect(() => {
    // 页面加载时上报
    sdk.track('page_view', {
      page: location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      timestamp: Date.now()
    });
  }, [location]);
}

// 原生 JavaScript 示例
window.addEventListener('load', () => {
  sdk.track('page_view', {
    page: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer
  });
});

// 或使用 SDK 提供的 trackPage 方法（更简洁）
sdk.trackPage(window.location.pathname, {
  page_title: document.title
});`}
                    onCopy={() => handleCopy(`// 页面浏览事件示例
sdk.track('page_view', {
  page: window.location.pathname,
  page_title: document.title,
  referrer: document.referrer
});

// 或使用 trackPage 方法
sdk.trackPage(window.location.pathname, {
  page_title: document.title
});`, '页面浏览事件代码')}
                  />
                </div>
              ),
            },
            {
              key: 'button_click',
              label: (
                <Space>
                  <Text strong>按钮点击事件（button_click）</Text>
                  <Tag color="green">常用</Tag>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text type="secondary">事件说明：</Text> 用于追踪用户点击按钮的行为，帮助分析用户交互。
                  </Paragraph>
                  <Paragraph>
                    <Text type="secondary">使用场景：</Text> 按钮点击、链接点击、表单提交
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <CodeBlock
                    code={`// React 示例
function SubmitButton() {
  const handleClick = () => {
    // 上报点击事件
    sdk.track('button_click', {
      button_id: 'submit-btn',
      button_text: '提交',
      form_id: 'contact-form',
      page: window.location.pathname
    });
    
    // 执行实际的提交逻辑
    // handleSubmit();
  };

  return <button onClick={handleClick}>提交</button>;
}

// 原生 JavaScript 示例
document.getElementById('submit-btn').addEventListener('click', (e) => {
  sdk.track('button_click', {
    button_id: e.target.id,
    button_text: e.target.textContent,
    form_id: 'contact-form',
    page: window.location.pathname
  });
});`}
                    onCopy={() => handleCopy(`// 按钮点击事件示例
sdk.track('button_click', {
  button_id: 'submit-btn',
  button_text: '提交',
  form_id: 'contact-form',
  page: window.location.pathname
});`, '按钮点击事件代码')}
                  />
                </div>
              ),
            },
            {
              key: 'custom_event',
              label: (
                <Space>
                  <Text strong>自定义业务事件（custom_event）</Text>
                  <Tag color="orange">业务</Tag>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text type="secondary">事件说明：</Text> 用于追踪自定义的业务行为，如购买、注册、搜索等。
                  </Paragraph>
                  <Paragraph>
                    <Text type="secondary">使用场景：</Text> 业务关键行为、转化漏斗、用户行为分析
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <CodeBlock
                    code={`// 购买事件示例
function handlePurchase(product) {
  sdk.track('purchase', {
    product_id: product.id,
    product_name: product.name,
    product_price: product.price,
    product_category: product.category,
    quantity: 1,
    total_amount: product.price,
    currency: 'CNY'
  });
}

// 搜索事件示例
function handleSearch(keyword) {
  sdk.track('search', {
    keyword: keyword,
    search_type: 'product',
    result_count: searchResults.length,
    page: window.location.pathname
  });
}

// 注册事件示例
function handleRegister(userInfo) {
  sdk.track('user_register', {
    user_id: userInfo.id,
    register_method: 'email',
    register_source: 'landing_page',
    timestamp: Date.now()
  });
  
  // 设置用户ID
  sdk.setUser(userInfo.id);
}`}
                    onCopy={() => handleCopy(`// 自定义业务事件示例
// 购买事件
sdk.track('purchase', {
  product_id: 'prod-123',
  product_name: '商品名称',
  product_price: 99.99,
  quantity: 1
});

// 搜索事件
sdk.track('search', {
  keyword: '搜索关键词',
  result_count: 10
});

// 注册事件
sdk.track('user_register', {
  user_id: 'user-123',
  register_method: 'email'
});
sdk.setUser('user-123');`, '自定义业务事件代码')}
                  />
                </div>
              ),
            },
            {
              key: 'error',
              label: (
                <Space>
                  <Text strong>错误事件（error）</Text>
                  <Tag color="red">重要</Tag>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text type="secondary">事件说明：</Text> 用于追踪应用中的错误，帮助快速定位和修复问题。
                  </Paragraph>
                  <Paragraph>
                    <Text type="secondary">使用场景：</Text> JavaScript 错误、API 请求失败、业务逻辑错误
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <CodeBlock
                    code={`// 使用 SDK 提供的 trackError 方法（推荐）
try {
  // 可能出错的代码
  const result = await fetchData();
} catch (error) {
  // 上报错误事件
  sdk.trackError('API Error', {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    api_endpoint: '/api/data',
    error_type: 'network_error'
  });
}

// 手动上报业务错误
function handleBusinessError(error) {
  sdk.trackError('Business Error', {
    error_code: error.code,
    error_message: error.message,
    user_action: 'submit_form',
    page: window.location.pathname
  });
}

// 注意：如果启用了错误探针（enable.error: true），
// SDK 会自动捕获 JavaScript 错误，无需手动上报`}
                    onCopy={() => handleCopy(`// 错误事件示例
// 使用 trackError 方法
try {
  // 可能出错的代码
} catch (error) {
  sdk.trackError('API Error', {
    message: error.message,
    stack: error.stack,
    url: window.location.href
  });
}

// 手动上报业务错误
sdk.trackError('Business Error', {
  error_code: 'E001',
  error_message: '业务错误描述'
});`, '错误事件代码')}
                  />
                </div>
              ),
            },
            {
              key: 'advanced',
              label: (
                <Space>
                  <Text strong>高级用法</Text>
                  <Tag color="purple">高级</Tag>
                </Space>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text type="secondary">事件说明：</Text> SDK 提供的高级功能，包括优先级控制、手动刷新等。
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <CodeBlock
                    code={`// 1. 设置用户ID
sdk.setUser('user-123');

// 2. 发送高优先级事件（立即发送，不进入队列）
sdk.track('critical_error', {
  error_type: 'payment_failed',
  order_id: 'order-123'
}, 'high');

// 3. 发送低优先级事件（延迟发送，降低性能影响）
sdk.track('background_sync', {
  sync_type: 'data_backup'
}, 'low');

// 4. 手动刷新队列（立即发送所有待发送事件）
sdk.flush().then(() => {
  console.log('所有事件已发送');
});

// 5. 页面卸载时确保事件发送
window.addEventListener('beforeunload', () => {
  // SDK 会自动在页面卸载时发送剩余事件
  // 也可以手动调用 flush 确保发送
  sdk.flush();
});`}
                    onCopy={() => handleCopy(`// 高级用法示例
// 设置用户ID
sdk.setUser('user-123');

// 高优先级事件
sdk.track('critical_error', { error_type: 'payment_failed' }, 'high');

// 低优先级事件
sdk.track('background_sync', { sync_type: 'data_backup' }, 'low');

// 手动刷新队列
sdk.flush().then(() => {
  console.log('所有事件已发送');
});`, '高级用法代码')}
                  />
                </div>
              ),
            },
          ]}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* 事件定义列表（如果项目已配置） */}
      {eventDefinitions.length > 0 && (
        <Card 
          style={{ 
            marginTop: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '8px'
          }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>项目已配置的事件定义</Title>
            <Button
              type="link"
              icon={<SettingOutlined />}
              onClick={() => navigate('/app/event-management')}
            >
              管理事件定义
            </Button>
          </Space>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            以下是当前项目已配置的事件定义。您可以在代码中参考这些事件的参数结构进行埋点。
          </Paragraph>
          
          <Table
            dataSource={eventDefinitions}
            rowKey="id"
            pagination={eventDefinitions.length > 10 ? { pageSize: 10 } : false}
            columns={[
              {
                title: '事件名称',
                dataIndex: 'eventName',
                key: 'eventName',
                render: (text: string) => <Text code>{text}</Text>,
              },
              {
                title: '事件描述',
                dataIndex: 'description',
                key: 'description',
              },
              {
                title: '参数结构',
                dataIndex: 'paramsSchema',
                key: 'paramsSchema',
                render: (schema: Record<string, any>) => {
                  if (!schema || Object.keys(schema).length === 0) {
                    return <Text type="secondary">无参数</Text>;
                  }
                  return (
                    <Collapse
                      size="small"
                      items={[
                        {
                          key: 'schema',
                          label: `查看参数结构 (${Object.keys(schema).length} 个参数)`,
                          children: (
                            <Descriptions
                              column={1}
                              size="small"
                              bordered
                            >
                              {Object.entries(schema).map(([key, value]: [string, any]) => (
                                <Descriptions.Item key={key} label={key}>
                                  <Space direction="vertical" size="small">
                                    <Text>
                                      <Text strong>类型：</Text> {value.type || 'any'}
                                    </Text>
                                    {value.description && (
                                      <Text>
                                        <Text strong>说明：</Text> {value.description}
                                      </Text>
                                    )}
                                    {value.required !== undefined && (
                                      <Tag color={value.required ? 'red' : 'default'}>
                                        {value.required ? '必填' : '可选'}
                                      </Tag>
                                    )}
                                  </Space>
                                </Descriptions.Item>
                              ))}
                            </Descriptions>
                          ),
                        },
                      ]}
                    />
                  );
                },
              },
              {
                title: '示例代码',
                key: 'example',
                render: (_: any, record: EventDefinition) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const exampleCode = `sdk.track('${record.eventName}', {
  // 根据参数结构填写参数
  // ${record.description || '无描述'}
});`;
                      handleCopy(exampleCode, `事件 ${record.eventName} 示例代码`);
                    }}
                  >
                    复制示例
                  </Button>
                ),
              },
            ]}
            loading={loadingEvents}
          />
        </Card>
      )}

      {/* 如果没有事件定义，显示提示 */}
      {!loadingEvents && eventDefinitions.length === 0 && (
        <Card 
          style={{ 
            marginTop: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '8px'
          }}
        >
          <Alert
            message="暂无事件定义"
            description={
              <div>
                <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                  当前项目尚未配置事件定义。您可以：
                </Paragraph>
                <Paragraph style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                  1. 前往 <Button type="link" size="small" onClick={() => navigate('/app/event-management')}>事件管理</Button> 页面配置事件定义
                </Paragraph>
                <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  2. 或直接使用自定义事件名称进行埋点（SDK 会自动创建事件定义）
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
            action={
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => navigate('/app/event-management')}
              >
                去配置
              </Button>
            }
          />
        </Card>
      )}

      {/* 步骤 4: 验证接入 */}
      <Card 
        style={{ 
          marginTop: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '8px'
        }}
      >
        <Title level={4}>步骤 4：验证接入成功</Title>
        <Paragraph>
          完成 SDK 接入后，请按照以下步骤验证接入是否成功。
        </Paragraph>

        <Steps
          direction="vertical"
          size="small"
          items={[
            {
              title: '打开浏览器开发者工具',
              description: (
                <div>
                  <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                    按 <Text code>F12</Text> 或右键选择"检查"打开开发者工具
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    切换到 <Text code>Network（网络）</Text> 标签页
                  </Paragraph>
                </div>
              ),
              icon: <InfoCircleOutlined />,
            },
            {
              title: '查看网络请求',
              description: (
                <div>
                  <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                    在 Network 面板中，过滤关键字：<Text code>track</Text>
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    查看是否有请求发送到上报地址：<Text code>{endpoint}</Text>
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    请求方法应为 <Text code>POST</Text>，状态码应为 <Text code>200</Text>
                  </Paragraph>
                </div>
              ),
              icon: <InfoCircleOutlined />,
            },
            {
              title: '检查事件',
              description: (
                <div>
                  <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                    前往 <Button type="link" size="small" onClick={() => navigate('/app/events')}>事件</Button> 页面查看是否有新数据
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    如果看到上报的事件数据，说明接入成功
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    数据可能有 1-2 分钟的延迟，请耐心等待
                  </Paragraph>
                </div>
              ),
              icon: <InfoCircleOutlined />,
            },
          ]}
          style={{ marginTop: 16 }}
        />

        <Divider />

        {/* 快速测试工具 */}
        <div>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>快速测试工具</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                点击下方按钮，系统会自动发送一条测试事件，帮助您快速验证接入是否成功。
              </Paragraph>
            </div>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleSendTestEvent}
              loading={testing}
              disabled={!testSdk || !projectId}
              size="large"
            >
              {testing ? '发送中...' : '发送测试事件'}
            </Button>

            {testResult && (
              <Alert
                message={
                  <Space>
                    {testResult.success ? (
                      <>
                        <CheckCircleFilled style={{ color: '#52c41a' }} />
                        <span>{testResult.message}</span>
                      </>
                    ) : (
                      <>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <span>{testResult.message}</span>
                      </>
                    )}
                  </Space>
                }
                description={
                  testResult.success ? (
                    <div>
                      <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                        {testResult.details && (
                          <pre style={{ 
                            margin: '8px 0 0 0', 
                            padding: '8px', 
                            background: '#f5f5f5', 
                            borderRadius: '4px',
                            fontSize: '11px',
                            overflowX: 'auto'
                          }}>
                            {testResult.details}
                          </pre>
                        )}
                      </Paragraph>
                      <Paragraph style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                        • 请打开浏览器开发者工具的 Network 面板，查看是否有请求发送到上报地址
                      </Paragraph>
                      <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                        • 等待 1-2 分钟后，前往 <Button type="link" size="small" onClick={() => navigate('/app/events')}>事件</Button> 页面查看数据
                      </Paragraph>
                    </div>
                  ) : (
                    <div>
                      <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                        {testResult.details}
                      </Paragraph>
                      <Paragraph style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                        • 请检查网络连接是否正常
                      </Paragraph>
                      <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                        • 请检查上报地址是否正确：<Text code>{endpoint}</Text>
                      </Paragraph>
                      <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                        • 请检查浏览器控制台是否有错误信息
                      </Paragraph>
                    </div>
                  )
                }
                type={testResult.success ? 'success' : 'error'}
                showIcon
                closable
                onClose={() => setTestResult(null)}
              />
            )}

            <Alert
              message="测试说明"
              description={
                <div>
                  <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                    • 测试事件名称：<Text code>integration_test</Text>
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    • 测试事件会立即发送（使用高优先级），无需等待批量刷新
                  </Paragraph>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    • 如果测试成功，您可以在"事件"页面中查看该事件
                  </Paragraph>
                </div>
              }
              type="info"
              showIcon
              style={{ fontSize: '12px' }}
            />
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default IntegrationSteps;

