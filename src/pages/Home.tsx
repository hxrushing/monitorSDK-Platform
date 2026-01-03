import React, { useState } from 'react';
import { Layout, Menu, Select, Button, message } from 'antd';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import Dashboard from '../components/Dashboard';
import EventDefinitionManager from '../components/EventDefinitionManager';
import useGlobalStore from '../store/globalStore';
import { setPerformanceCollectionEnabled as setPerformanceMonitoringEnabled } from '../utils/performance';

const { Header, Content } = Layout;

const projects = [
  { label: '示例项目', value: 'demo-project' },
  // 这里可以从后端获取项目列表
];

const menuItems = [
  { key: 'dashboard', label: '数据看板' },
  { key: 'event-definitions', label: '事件管理' },
];

const Home: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState(projects[0].value);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const performanceCollectionEnabled = useGlobalStore(state => state.performanceCollectionEnabled);
  const setPerformanceCollectionEnabled = useGlobalStore(state => state.setPerformanceCollectionEnabled);

  // 处理性能采集开关切换
  const handleTogglePerformanceCollection = () => {
    const newState = !performanceCollectionEnabled;
    
    // 同时更新 globalStore 和 performance.ts 中的状态
    setPerformanceCollectionEnabled(newState);
    setPerformanceMonitoringEnabled(newState);
    
    // 显示用户提示
    if (newState) {
      message.success('性能采集已开启');
    } else {
      message.info('性能采集已关闭');
    }
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard projectId={selectedProject} />;
      case 'event-definitions':
        return <EventDefinitionManager projectId={selectedProject} />;
      default:
        return null;
    }
  };

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div className="logo" style={{ color: 'white', marginRight: 24 }}>
          埋点分析平台
        </div>
        <Select
          value={selectedProject}
          onChange={setSelectedProject}
          options={projects}
          style={{ width: 200, marginRight: 24 }}
        />
        <Button
          type={performanceCollectionEnabled ? 'default' : 'primary'}
          danger={performanceCollectionEnabled}
          icon={performanceCollectionEnabled ? <StopOutlined /> : <PlayCircleOutlined />}
          onClick={handleTogglePerformanceCollection}
          style={{ marginRight: 24 }}
        >
          {performanceCollectionEnabled ? '一键关闭' : '一键开始'}
        </Button>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selectedMenu]}
          items={menuItems}
          onClick={({ key }) => setSelectedMenu(key)}
          style={{ flex: 1 }}
        />
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 280 }}>
          {renderContent()}
        </div>
      </Content>
    </Layout>
  );
};

export default Home;