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
import { Layout, Menu, Button, theme, Select, Modal, Form, Input, message, Dropdown, Space } from 'antd';
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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('demo-project');
  const userInfo = useGlobalStore(state => state.userInfo);
  const setUserInfo = useGlobalStore(state => state.setUserInfo);
  const [logoPosition, setLogoPosition] = useState({ x: 0, y: 0 });
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

  const menuItems = [
    {
      key: '/app/dashboard',
      icon: <DashboardOutlined />,
      label: '数据概览',
    },
    {
      key: '/app/events',
      icon: <LineChartOutlined />,
      label: '事件分析',
    },
    {
      key: '/app/funnel',
      icon: <ApartmentOutlined />,
      label: '漏斗分析',
    },
    {
      key: '/app/event-management',
      icon: <SettingOutlined />,
      label: '事件管理',
    },
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

  const userMenuItems = [
    {
      key: 'logout',
      icon: <UserOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    const rect = logoRef.current?.getBoundingClientRect();
    if (rect) {
      setLogoPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
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
      console.log('Logo center:', logoCenter);
      console.log('UserInfo center:', userInfoCenter);
      console.log('Distance:', distance);
      
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
      <Sider trigger={null} collapsible collapsed={collapsed}>
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
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            transition: 'all 0.3s',
            cursor: 'move',
            position: 'relative',
            zIndex: 1000
          }}
        >
          <img 
            src={collapsed ? logo1 : logo2} 
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
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
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