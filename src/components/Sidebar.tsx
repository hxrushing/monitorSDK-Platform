import { Layout, Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  BarChartOutlined,
  FunnelPlotOutlined,
  SettingOutlined
} from '@ant-design/icons'

const { Sider } = Layout

/**
 * 侧边栏组件
 * 提供导航菜单和布局结构
 */
const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * 菜单项配置
   * 定义导航菜单的结构和路由
   */
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/events',
      icon: <BarChartOutlined />,
      label: '事件分析'
    },
    {
      key: '/funnel',
      icon: <FunnelPlotOutlined />,
      label: '漏斗分析'
    },
    {
      key: '/event-management',
      icon: <SettingOutlined />,
      label: '事件定义'
    }
  ]

  return (
    <Sider width={200} style={{ background: '#fff' }}>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  )
}

export default Sidebar 