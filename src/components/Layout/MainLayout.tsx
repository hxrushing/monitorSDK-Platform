import React, { useState, useEffect, useRef } from 'react';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  SettingOutlined,
  LineChartOutlined,
  ApartmentOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Layout, Menu, Button, theme, Select, Modal, Form, Input, message, Dropdown, Space, Switch, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { apiService, Project } from '@/services/api';
import logo1 from '@/assets/logo1.png';
import logo2 from '@/assets/logo2.png';
import useGlobalStore from '@/store/globalStore';

const { Header, Sider, Content } = Layout;
const { Option } = Select;

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
  const [selectedProject, setSelectedProject] = useState<string>('demo-project');
  const userInfo = useGlobalStore(state => state.userInfo);
  const setUserInfo = useGlobalStore(state => state.setUserInfo);
  const themeMode = useGlobalStore(state => state.themeMode);
  const setThemeMode = useGlobalStore(state => state.setThemeMode);
  const siteSettings = useGlobalStore(state => state.siteSettings);
  const [isDragging, setIsDragging] = useState(false);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

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
      if (!selectedProject && projectList.length > 0) {
        setSelectedProject(projectList[0].id);
      }
    } catch (error) {
      message.error('获取项目列表失败');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const isAdmin = (userInfo as any)?.role === 'Admin' || ((userInfo as any)?.username === 'admin');

  // 菜单分组：分析 / 管理 / 系统
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const PATH_TO_GROUP_KEY: Record<string, string> = {
    '/app/dashboard': 'group-analysis',
    '/app/events': 'group-analysis',
    '/app/funnel': 'group-analysis',
    '/app/event-management': 'group-management',
    '/app/member-management': 'group-management',
    '/app/settings': 'group-system',
    '/app/sdk-demo': 'group-example',
    '/app/sdk-module': 'group-example'
  };

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
        }
      ]
    },
    {
      key: 'group-example',
      label: '示例',
      children: [
        {
          key: '/app/sdk-demo',
          icon: <SettingOutlined />,
          label: 'SDK 模板'
        },
        {
          key: '/app/sdk-module',
          icon: <SettingOutlined />,
          label: 'SDK 模块'
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
    navigate(key);
  };

  // 根据当前路径，自动展开所属分组
  useEffect(() => {
    const groupKey = PATH_TO_GROUP_KEY[location.pathname];
    if (groupKey) {
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
  };

  const handleDrag = (e: React.DragEvent) => {
    if (!isDragging) return;
    
    const logoRect = logoRef.current?.getBoundingClientRect();
    const userInfoRect = userInfoRef.current?.getBoundingClientRect();
    
    if (logoRect && userInfoRect) {
      // 计算logo中心点
      const logoCenter = {
        x: e.clientX,
        y: e.clientY
      };
      
      // 计算用户信息区域中心点
      const userInfoCenter = {
        x: userInfoRect.left + userInfoRect.width / 2,
        y: userInfoRect.top + userInfoRect.height / 2
      };
      
      // 计算距离
      const distance = Math.sqrt(
        Math.pow(logoCenter.x - userInfoCenter.x, 2) +
        Math.pow(logoCenter.y - userInfoCenter.y, 2)
      );
      
      // 调试信息
      // console.log('Logo center:', logoCenter);
      // console.log('UserInfo center:', userInfoCenter);
      // console.log('Distance:', distance);
      
      // 当距离小于150像素时触发（增加触发范围）
      if (distance < 150 && userInfo) {
        message.success(`Welcome ${userInfo.username}!`);
        setIsDragging(false);
      }
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // 重置logo位置
    if (logoRef.current) {
      logoRef.current.style.transform = 'none';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme={themeMode === 'dark' ? 'dark' : 'light'}>
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
            background: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.04)',
            borderRadius: '8px',
            padding: '4px',
            transition: 'all 0.3s',
            cursor: 'move',
            position: 'relative',
            zIndex: 1000
          }}
        >
          <img 
            src={siteSettings.logoUrl || (collapsed ? logo1 : logo2)} 
            alt="Logo" 
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
        <Menu
          theme={themeMode === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems as any}
          onClick={handleMenuClick as any}
        />
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
              <Tooltip title={themeMode === 'dark' ? '切换为浅色' : '切换为暗色'}>
                <Switch
                  checkedChildren="🌙"
                  unCheckedChildren="☀️"
                  checked={themeMode === 'dark'}
                  onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
                />
              </Tooltip>
              <Select
                value={selectedProject}
                style={{ width: 200 }}
                onChange={setSelectedProject}
              >
                {projects.map(project => (
                  <Option key={project.id} value={project.id}>
                    {project.name}
                  </Option>
                ))}
              </Select>
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
  );
};

export default MainLayout; 