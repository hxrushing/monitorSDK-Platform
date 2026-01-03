import React, { useState, useEffect, useRef } from 'react';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  SettingOutlined,
  LineChartOutlined,
  ApartmentOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  BugOutlined,
  RobotOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  BookOutlined
} from '@ant-design/icons';
import { Layout, Menu, Button, theme, Select, Modal, Form, Input, message, Dropdown, Space, Switch, Tooltip, Drawer, Typography, Divider } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { apiService, Project } from '@/services/api';
import logo1 from '@/assets/logo1.jpg';
import logo2 from '@/assets/logo2.jpg';
import useGlobalStore from '@/store/globalStore';
import OptimizedImage from '@/components/OptimizedImage';
import PreloadResources from '@/components/PreloadResources';
import { setPerformanceCollectionEnabled } from '@/utils/performance';

const { Header, Sider, Content } = Layout;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { colorBgContainer } = useTheme();
  theme.useToken();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<Project[]>([]);
  const userInfo = useGlobalStore(state => state.userInfo);
  const setUserInfo = useGlobalStore(state => state.setUserInfo);
  const themeMode = useGlobalStore(state => state.themeMode);
  const setThemeMode = useGlobalStore(state => state.setThemeMode);
  const siteSettings = useGlobalStore(state => state.siteSettings);
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);
  const setSelectedProjectId = useGlobalStore(state => state.setSelectedProjectId);
  const performanceCollectionEnabled = useGlobalStore(state => state.performanceCollectionEnabled);
  const setPerformanceCollectionEnabledStore = useGlobalStore(state => state.setPerformanceCollectionEnabled);
  const [isDragging, setIsDragging] = useState(false);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [helpDrawerVisible, setHelpDrawerVisible] = useState(false);
  // 缓存布局信息，避免频繁读取导致强制重排
  const layoutCacheRef = useRef<{
    userInfoRect: DOMRect | null;
    lastUpdate: number;
  }>({ userInfoRect: null, lastUpdate: 0 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('当前用户信息:', userInfo);
    if (userInfo) {
      console.log('用户信息结构:', Object.keys(userInfo));
      console.log('用户名:', (userInfo as any).username);
    } else {
      console.log('用户信息为空');
    }
  }, []);

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const projectList = await apiService.getProjects();
      setProjects(projectList);
      // 如果没有选中的项目，选择第一个
      if (!selectedProjectId && projectList.length > 0) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (error) {
      message.error('获取项目列表失败');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + B 切换侧边栏
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setCollapsed(!collapsed);
      }
      // Ctrl/Cmd + ? 打开帮助
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        setHelpDrawerVisible(true);
      }
      // Ctrl/Cmd + K 快速搜索（可以后续实现）
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        message.info('快速搜索功能开发中...');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed]);

  const isAdmin = (userInfo as any)?.role === 'Admin' || ((userInfo as any)?.username === 'admin');

  // 菜单分组：分析 / 管理 / 系统
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const PATH_TO_GROUP_KEY: Record<string, string> = {
    '/app/dashboard': 'group-analysis',
    '/app/events': 'group-analysis',
    '/app/funnel': 'group-analysis',
    '/app/performance': 'group-analysis',
    '/app/prediction': 'group-prediction',
    '/app/prediction/history': 'group-prediction',
    '/app/event-management': 'group-management',
    '/app/member-management': 'group-management',
    '/app/integration': 'group-management',
    '/app/settings': 'group-system',
    '/app/ai-summary': 'group-system',
    '/app/pluggable-sdk-test': 'group-example'
  };

  // 检查当前路径是否为接入指引页
  const isIntegrationPage = location.pathname.startsWith('/app/integration/');

  const menuItems = [
    {
      key: 'group-analysis',
      label: '分析',
      children: [
        {
          key: '/app/dashboard',
          icon: <DashboardOutlined />,
          label: '看板',
        },
        {
          key: '/app/events',
          icon: <LineChartOutlined />,
          label: '事件',
        },
        {
          key: '/app/funnel',
          icon: <ApartmentOutlined />,
          label: '漏斗',
        },
        {
          key: '/app/performance',
          icon: <ThunderboltOutlined />,
          label: '性能',
        },
      ]
    },
    {
      key: 'group-prediction',
      label: '预测',
      children: [
        {
          key: '/app/prediction',
          icon: <LineChartOutlined />,
          label: '时序预测',
        },
        {
          key: '/app/prediction/history',
          icon: <HistoryOutlined />,
          label: '预测历史',
        },
      ]
    },
    {
      key: 'group-management',
      label: '管理',
      children: [
        {
          key: '/app/event-management',
          icon: <SettingOutlined />,
          label: (
            <Tooltip title={!isAdmin ? '需要管理员权限' : undefined}>
              <span>事件定义</span>
            </Tooltip>
          ),
          disabled: !isAdmin
        },
        {
          key: '/app/member-management',
          icon: <UserOutlined />,
          label: (
            <Tooltip title={!isAdmin ? '需要管理员权限' : undefined}>
              <span>成员</span>
            </Tooltip>
          ),
          disabled: !isAdmin
        },
        {
          key: selectedProjectId ? `/app/integration/${selectedProjectId}` : '/app/integration',
          icon: <BookOutlined />,
          label: '接入指引',
          disabled: !selectedProjectId
        }
      ]
    },
    {
      key: 'group-example',
      label: '示例',
      children: [
        {
          key: '/app/sdk-test',
          icon: <BugOutlined />,
          label: '可插拔SDK测试'
        }
      ]
    },
    {
      key: 'group-system',
      label: '系统',
      children: [
        {
          key: '/app/settings',
          icon: <SettingOutlined />,
          label: '设置'
        },
        {
          key: '/app/ai-summary',
          icon: <RobotOutlined />,
          label: 'AI 智能总结'
        }
      ]
    }
  ];

  const handleCreateProject = async (values: any) => {
    try {
      await apiService.createProject(values);
      message.success('项目创建成功');
      setIsModalVisible(false);
      form.resetFields();
      // 刷新项目列表
      fetchProjects();
    } catch (error) {
      message.error('项目创建失败');
    }
  };

  const handleLogout = () => {
    setUserInfo(null);
    navigate('/login');
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    // 在分组结构下需要检查子项权限
    const isChildDisabled = menuItems
      .flatMap((g: any) => g.children || [])
      .some((c: any) => c.key === key && c.disabled);
    if (isChildDisabled && !isAdmin) {
      message.warning('当前功能需要管理员权限，请联系管理员');
      return;
    }
    // 如果是接入指引且没有 projectId，提示用户先选择项目
    if (key.includes('/integration') && !selectedProjectId) {
      message.warning('请先选择项目');
      return;
    }
    navigate(key);
  };

  // 处理项目切换
  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProjectId(projectId);
      message.success(`已切换到项目: ${project.name}`);
    }
  };

  // 处理性能采集开关切换
  const handlePerformanceCollectionToggle = (enabled: boolean) => {
    setPerformanceCollectionEnabledStore(enabled);
    setPerformanceCollectionEnabled(enabled);
    message.success(`性能数据采集已${enabled ? '启用' : '禁用'}`);
  };

  // 根据当前路径，自动展开所属分组
  useEffect(() => {
    // 处理动态路由，如 /app/integration/:projectId
    let groupKey: string | undefined;
    
    if (location.pathname.startsWith('/app/integration/')) {
      groupKey = 'group-management';
    } else {
      groupKey = PATH_TO_GROUP_KEY[location.pathname];
    }
    
    if (groupKey) {
      // 只展开当前路径所属的分组，收缩其他分组
      setOpenKeys([groupKey]);
    }
  }, [location.pathname]);

  const userMenuItems = [
    {
      key: 'logout',
      icon: <UserOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  const handleDragStart = () => {
    setIsDragging(true);
    // 在拖拽开始时缓存布局信息，避免在拖拽过程中频繁读取
    if (userInfoRef.current) {
      layoutCacheRef.current.userInfoRect = userInfoRef.current.getBoundingClientRect();
      layoutCacheRef.current.lastUpdate = Date.now();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    if (!isDragging) return;
    
    // 使用 requestAnimationFrame 节流，避免频繁触发强制重排
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      // 只在必要时更新缓存（每100ms更新一次，或首次）
      const now = Date.now();
      const shouldUpdateCache = 
        !layoutCacheRef.current.userInfoRect || 
        (now - layoutCacheRef.current.lastUpdate) > 100;
      
      let userInfoRect = layoutCacheRef.current.userInfoRect;
      
      if (shouldUpdateCache && userInfoRef.current) {
        // 批量读取布局属性，避免读写交替
        userInfoRect = userInfoRef.current.getBoundingClientRect();
        layoutCacheRef.current.userInfoRect = userInfoRect;
        layoutCacheRef.current.lastUpdate = now;
      }
      
      if (userInfoRect) {
        // 计算logo中心点（使用事件坐标，不需要读取DOM）
        const logoCenter = {
          x: e.clientX,
          y: e.clientY
        };
        
        // 计算用户信息区域中心点（使用缓存的布局信息）
        const userInfoCenter = {
          x: userInfoRect.left + userInfoRect.width / 2,
          y: userInfoRect.top + userInfoRect.height / 2
        };
        
        // 计算距离
        const distance = Math.sqrt(
          Math.pow(logoCenter.x - userInfoCenter.x, 2) +
          Math.pow(logoCenter.y - userInfoCenter.y, 2)
        );
        
        // 当距离小于150像素时触发
        if (distance < 150 && userInfo) {
          message.success(`Welcome ${userInfo.username}!`);
          setIsDragging(false);
        }
      }
      
      rafIdRef.current = null;
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // 取消待处理的动画帧
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // 清除缓存
    layoutCacheRef.current.userInfoRect = null;
    layoutCacheRef.current.lastUpdate = 0;
    // 重置logo位置（使用 requestAnimationFrame 确保在下一帧执行）
    requestAnimationFrame(() => {
      if (logoRef.current) {
        logoRef.current.style.transform = 'none';
      }
    });
  };

  return (
    <>
      <PreloadResources />
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed} 
          theme={themeMode === 'dark' ? 'dark' : 'light'}
          style={{ 
            display: 'flex',
            flexDirection: 'column',
          minHeight: '100vh',            // 至少等于视口高度
          height: '100%',                // 随内容高度增长
          alignSelf: 'stretch',          // 在父级中拉伸以匹配内容高度
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '0 12px 12px 0', // 右侧圆角
          }}
        >
        {/* Logo区域 - 固定顶部 */}
        <div
          ref={logoRef}
          draggable
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          style={{ 
            height: 48, 
            margin: 16, 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--primary-alpha-10)',
            borderRadius: '8px',
            padding: '4px',
            transition: 'all 0.3s',
            cursor: 'move',
            position: 'relative',
            zIndex: 1000,
            flexShrink: 0
          }}
        >
          <OptimizedImage
            src={siteSettings.logoUrl || (collapsed ? logo1 : logo2)}
            alt="Logo"
            width={collapsed ? 48 : 160}
            height={48}
            loading="eager"
            isLCP={true}
            fetchPriority="high"
            style={{ 
              height: '100%',
              width: collapsed ? '48px' : '160px',
              objectFit: 'contain',
              transition: 'all 0.3s',
              borderRadius: '6px',
              pointerEvents: 'none'
            }}
          />
        </div>
        
        {/* 菜单区域 - 可滚动，自动填充剩余空间 */}
        <div 
          className="sidebar-menu-container"
          style={{ 
            flex: 1,
            overflow: 'auto',
            minHeight: 0, // 重要：允许flex子元素缩小
            paddingBottom: '8px'
          }}
        >
          <Menu
            theme={themeMode === 'dark' ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[
              // 对于接入指引页，需要匹配动态路由
              isIntegrationPage && selectedProjectId 
                ? `/app/integration/${selectedProjectId}` 
                : location.pathname
            ]}
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
            items={menuItems as any}
            onClick={handleMenuClick as any}
            style={{ 
              border: 'none',
              height: '100%'
            }}
          />
        </div>
        
        {/* 底部帮助区域 - 固定在底部 */}
        <div 
          className="sidebar-help-container"
          style={{ 
            flexShrink: 0,
            padding: '12px 16px',
            borderTop: `1px solid var(--primary-alpha-10)`,
            background: 'var(--app-bg)',
            position: 'sticky',
            bottom: 0,
            zIndex: 100,
            marginTop: 'auto'
          }}
        >
          {/* 帮助按钮 */}
          <Tooltip title="快捷键帮助 (Ctrl+/)">
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => setHelpDrawerVisible(true)}
              style={{ 
                width: '100%',
                color: 'var(--sider-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                height: '40px',
                padding: '0 8px'
              }}
            >
              {!collapsed && <span style={{ marginLeft: 8 }}>帮助</span>}
            </Button>
          </Tooltip>
        </div>
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontWeight: 600 }}>{siteSettings.siteName}</span>
              <Tooltip title={performanceCollectionEnabled ? '点击禁用性能数据采集（飞行模式）' : '点击启用性能数据采集'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', color: performanceCollectionEnabled ? 'inherit' : '#ff4d4f' }}>
                    ✈️
                  </span>
                  <Switch
                    checked={!performanceCollectionEnabled}
                    onChange={(checked) => handlePerformanceCollectionToggle(!checked)}
                    style={{
                      minWidth: '44px'
                    }}
                  />
                </div>
              </Tooltip>
              <Tooltip title={themeMode === 'dark' ? '切换为浅色' : '切换为暗色'}>
                <Switch
                  checkedChildren="🌙"
                  unCheckedChildren="☀️"
                  checked={themeMode === 'dark'}
                  onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
                />
              </Tooltip>
              <Select
                value={selectedProjectId}
                style={{ width: 200 }}
                onChange={handleProjectChange}
              >
                {projects.map(project => (
                  <Option key={project.id} value={project.id}>
                    {project.name}
                  </Option>
                ))}
              </Select>
              {selectedProjectId && (
                <Button 
                  icon={<BookOutlined />}
                  onClick={() => {
                    // 先展开"管理"分组，收缩其他分组
                    setOpenKeys(['group-management']);
                    // 然后跳转到接入指引页
                    navigate(`/app/integration/${selectedProjectId}`);
                  }}
                  disabled={isIntegrationPage}
                >
                  接入指引
                </Button>
              )}
              <Button type="primary" onClick={() => setIsModalVisible(true)}>创建项目</Button>
              {userInfo && (
                <div ref={userInfoRef}>
                  <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                    <Space className="user-info" style={{ cursor: 'pointer', padding: '0 12px' }}>
                      <UserOutlined />
                      <span>{(userInfo as any).username}</span>
                    </Space>
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            minHeight: 280,
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* 帮助抽屉 */}
      <Drawer
        title="快捷键帮助与使用指南"
        placement="right"
        width={400}
        open={helpDrawerVisible}
        onClose={() => setHelpDrawerVisible(false)}
      >
        <div style={{ padding: '0 16px' }}>
          <Title level={4}>键盘快捷键</Title>
          <div style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>Ctrl + B</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>切换侧边栏折叠状态</Text>
              </div>
              <div>
                <Text strong>Ctrl + /</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>打开帮助中心</Text>
              </div>
              <div>
                <Text strong>Ctrl + K</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>快速搜索（开发中）</Text>
              </div>
            </Space>
          </div>

          <Divider />

          <Title level={4}>功能说明</Title>
          <div style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>侧边栏折叠</Text>
                <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  点击折叠按钮或使用 Ctrl+B 可以收起侧边栏为图标模式，鼠标悬停可查看完整菜单
                </Paragraph>
              </div>
              <div>
                <Text strong>徽章提示</Text>
                <Paragraph style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  菜单项上的数字徽章显示待处理的任务或消息数量
                </Paragraph>
              </div>
            </Space>
          </div>
          <Divider />
        </div>
      </Drawer>

      <Modal
        title="创建新项目"
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
      </Layout>
    </>
  );
};

export default MainLayout; 