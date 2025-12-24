import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Breadcrumb, Input, Tag, Space, Row, Col, message, Skeleton, Result, Button } from 'antd';
import { HomeOutlined, CopyOutlined, CheckCircleOutlined, ClockCircleOutlined, ArrowLeftOutlined, RightOutlined } from '@ant-design/icons';
import useGlobalStore from '@/store/globalStore';
import { apiService, Project } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

/**
 * 接入指引页组件
 * 用于指导业务方快速、正确地接入埋点 SDK
 */
const IntegrationGuide: React.FC = () => {
  const navigate = useNavigate();
  
  // 从路由参数获取 projectId
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  
  // 从全局状态获取 projectId（作为备选）
  const globalProjectId = useGlobalStore(state => state.selectedProjectId);
  
  // 优先使用路由参数，如果没有则使用全局状态
  const projectId = routeProjectId || globalProjectId;

  // 项目信息状态
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // 接入状态
  const [integrationStatus, setIntegrationStatus] = React.useState<'connected' | 'pending' | 'checking'>('checking');

  // 生成上报地址
  const getEndpoint = React.useCallback(() => {
    // 获取当前页面的 origin，用于生成完整的上报地址
    const origin = window.location.origin;
    // 由于 http.ts 中 baseURL 是 '/api'，所以完整路径是 '/api/track'
    return `${origin}/api/track`;
  }, []);

  const endpoint = getEndpoint();

  // 检查接入状态
  const checkIntegrationStatus = React.useCallback(async (projectId: string) => {
    try {
      // 通过获取今日概览数据来判断是否有数据上报
      const overview = await apiService.getDashboardOverview(projectId);
      const hasDataReported = overview.todayPV > 0 || overview.todayUV > 0;
      setIntegrationStatus(hasDataReported ? 'connected' : 'pending');
    } catch (err: any) {
      // 如果获取失败，可能是没有数据，默认为待接入状态
      console.log('检查接入状态失败，默认为待接入:', err);
      setIntegrationStatus('pending');
    }
  }, []);

  // 获取项目详情
  React.useEffect(() => {
    if (projectId) {
      setLoading(true);
      setError(null);
      setIntegrationStatus('checking');
      
      // 并行获取项目详情、检查接入状态
      Promise.all([
        // 获取项目详情
        apiService.getProjectDetail(projectId)
          .then(projectData => {
            setProject(projectData);
          })
          .catch((err: any) => {
            console.error('获取项目详情失败:', err);
            // 如果获取项目详情失败，尝试获取项目列表
            return apiService.getProjects()
              .then(projects => {
                const foundProject = projects.find(p => p.id === projectId);
                if (foundProject) {
                  setProject(foundProject);
                } else {
                  setError('项目不存在或无权访问');
                }
              })
              .catch(() => {
                setError(err?.message || '获取项目信息失败');
              });
          }),
        // 检查接入状态
        checkIntegrationStatus(projectId),
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [projectId, checkIntegrationStatus]);

  // 复制功能
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${label}已复制到剪贴板`);
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  // 面包屑
  const breadcrumbItems = [
    {
      title: <Link to="/app/dashboard"><HomeOutlined /></Link>,
    },
    {
      title: <Link to="/app/dashboard">项目列表</Link>,
    },
    {
      title: project?.name || '接入指引',
    },
  ];

  // 骨架屏组件
  const IntegrationGuideSkeleton = () => (
    <div>
      <Skeleton active paragraph={{ rows: 0 }} style={{ marginBottom: 16 }} />
      <Card>
        <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 3 }} />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 4 }} />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Skeleton active title={{ width: '35%' }} paragraph={{ rows: 6 }} />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 5 }} />
      </Card>
    </div>
  );

  // 错误状态页面
  if (error && !loading) {
    return (
      <div style={{ 
        padding: '24px', 
        maxWidth: '1200px', 
        margin: '0 auto',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Result
          status="error"
          title="获取项目信息失败"
          subTitle={error}
          extra={[
            <Button 
              type="primary" 
              key="back" 
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/app/dashboard')}
            >
              返回项目列表
            </Button>,
            <Button 
              key="retry" 
              onClick={() => {
                setError(null);
                if (projectId) {
                  setLoading(true);
                  apiService.getProjectDetail(projectId)
                    .then(projectData => {
                      setProject(projectData);
                      setLoading(false);
                    })
                    .catch((err: any) => {
                      setError(err?.message || '获取项目信息失败');
                      setLoading(false);
                    });
                }
              }}
            >
              重试
            </Button>
          ]}
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

      {/* 加载状态 */}
      {loading && <IntegrationGuideSkeleton />}

      {/* 主要内容 */}
      {!loading && (
        <>
          {/* 接入状态提示 */}
          {integrationStatus !== 'checking' && (
        <Alert
          message={
            <Space>
              {integrationStatus === 'connected' ? (
                <>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>已接入</span>
                  <Tag color="success">数据正常上报中</Tag>
                </>
              ) : (
                <>
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <span>待接入</span>
                  <Tag color="warning">尚未检测到数据上报</Tag>
                </>
              )}
            </Space>
          }
          description={
            integrationStatus === 'connected' 
              ? '检测到项目已有数据上报，SDK 接入成功！您可以在事件页面查看详细数据。'
              : '项目尚未接入 SDK 或暂无数据上报。请按照下方指引完成 SDK 的接入。'
          }
          type={integrationStatus === 'connected' ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {loading ? (
        <Card>
          <Spin />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {/* 项目信息卡片 */}
            <Col xs={24} lg={12}>
              <Card 
                title="项目信息" 
                style={{ 
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderRadius: '8px'
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <Text type="secondary">项目名称</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text strong>{project?.name || '未知项目'}</Text>
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary">项目 ID</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text 
                        copyable={{ 
                          text: projectId,
                          onCopy: () => handleCopy(projectId, '项目 ID')
                        }}
                        code
                        style={{ fontSize: '14px' }}
                      >
                        {projectId}
                      </Text>
                    </div>
                  </div>

                  {project?.description && (
                    <div>
                      <Text type="secondary">项目描述</Text>
                      <div style={{ marginTop: 4 }}>
                        <Paragraph style={{ margin: 0 }}>{project.description}</Paragraph>
                      </div>
                    </div>
                  )}

                  {project?.created_at && (
                    <div>
                      <Text type="secondary">创建时间</Text>
                      <div style={{ marginTop: 4 }}>
                        <Text>{new Date(project.created_at).toLocaleString('zh-CN')}</Text>
                      </div>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>

            {/* 上报地址卡片 */}
            <Col xs={24} lg={12}>
              <Card 
                title="上报地址" 
                style={{ 
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderRadius: '8px'
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <Text type="secondary">数据上报 URL</Text>
                    <div style={{ marginTop: 8 }}>
                      <Input.Group compact>
                        <Input
                          readOnly
                          value={endpoint}
                          style={{ 
                            flex: 1,
                            fontFamily: 'monospace',
                            fontSize: '13px'
                          }}
                        />
                        <Button
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy(endpoint, '上报地址')}
                          style={{ 
                            minWidth: '80px',
                            // 移动端按钮更大，方便触摸
                            minHeight: '44px',
                          }}
                        >
                          复制
                        </Button>
                      </Input.Group>
                    </div>
                  </div>
                  
                  <Alert
                    message="使用说明"
                    description={
                      <div>
                        <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                          此地址用于 SDK 初始化时的 <Text code>endpoint</Text> 参数。
                        </Paragraph>
                        <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                          请确保将此地址正确配置到您的 SDK 中。
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

          {/* 接入步骤入口 */}
          <Card 
            style={{ 
              marginTop: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              borderRadius: '8px',
              textAlign: 'center',
              padding: '40px 24px'
            }}
          >
            <Title level={3} style={{ marginBottom: 16 }}>
              开始接入 SDK
            </Title>
            <Paragraph type="secondary" style={{ fontSize: '16px', marginBottom: 32 }}>
              请按照以下步骤完成 SDK 的接入。每个步骤都提供了详细的说明和代码示例。
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<RightOutlined />}
              onClick={() => navigate(`/app/integration/${projectId}/steps`)}
              style={{
                minWidth: '200px',
                height: '48px',
                fontSize: '16px'
              }}
            >
              查看接入步骤
            </Button>
            <Paragraph type="secondary" style={{ marginTop: 16, fontSize: '12px' }}>
              包含：SDK 引入、初始化、埋点示例、验证接入等完整步骤
            </Paragraph>
          </Card>
        </>
      )}
      </>
      )}
    </div>
  );
};

export default IntegrationGuide;
