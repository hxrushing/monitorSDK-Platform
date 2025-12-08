import React, { useState, useEffect, Suspense  } from 'react';
import { Card, Row, Col, DatePicker, Statistic, Spin, message, Table, Button, Space, Badge } from 'antd';
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import { 
  QuestionCircleOutlined, 
  DashboardOutlined, 
  EyeOutlined, 
  UserOutlined, 
  FileTextOutlined, 
  ClockCircleOutlined,
  LineChartOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import type { TopProject } from '@/services/api';
import FloatingPanel from '@/components/FloatingPanel';
import useGlobalStore from '@/store/globalStore';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { RangePicker } = DatePicker;

const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);
  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [overview, setOverview] = useState({
    todayPV: 0,
    todayUV: 0,
    avgPages: 0,
    avgDuration: 0
  });
  const [topProjects, setTopProjects] = useState<TopProject[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 清空旧数据
      setStatsData([]);
      setOverview({
        todayPV: 0,
        todayUV: 0,
        avgPages: 0,
        avgDuration: 0
      });
      setTopProjects([]);
      
      const [stats, overviewData, topProjectsData] = await Promise.all([
        apiService.getStats({
          projectId: selectedProjectId,
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD')
        }),
        apiService.getDashboardOverview(selectedProjectId),
        apiService.getTopProjects({
          projectId: selectedProjectId,
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD')
        })
      ]);
      setStatsData(stats);
      setOverview(overviewData);
      setTopProjects(topProjectsData);
    } catch (error) {
      message.error('获取数据失败');
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedProjectId]);

  // 准备图表数据并应用LTTB采样
  const chartData = statsData.map(item => [
    { date: item.date, value: item.pv, type: 'PV' },
    { date: item.date, value: item.uv, type: 'UV' }
  ]).flat();
  
  // 使用LTTB算法进行智能采样，优化大数据量图表渲染性能
  const sampledChartData = adaptiveChartSampling(chartData, 500, 1000, 'date', 'value', 'type');

  const lineConfig = {
    data: sampledChartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: {
      appear: {
        animation: 'wave-in',
        duration: 1000,
      },
    },
  };

  const topProjectsColumns = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
    },
    {
      title: '访问次数',
      dataIndex: 'visitCount',
      key: 'visitCount',
      sorter: (a: TopProject, b: TopProject) => a.visitCount - b.visitCount,
    },
    {
      title: '独立访客',
      dataIndex: 'uniqueVisitors',
      key: 'uniqueVisitors',
      sorter: (a: TopProject, b: TopProject) => a.uniqueVisitors - b.uniqueVisitors,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div>
        {showHelp && (
          <FloatingPanel
            title="实时数据概览"
            defaultPosition={{ x: window.innerWidth - 320, y: 20 }}
            width={300}
            icon={<QuestionCircleOutlined />}
            onClose={() => setShowHelp(false)}
            collapsible={true}
            defaultCollapsed={false}
          >
            <div>
              <p>📊 <strong>今日实时数据</strong></p>
              <ul>
                <li>PV：{overview.todayPV || 0} 次</li>
                <li>UV：{overview.todayUV || 0} 人</li>
                <li>人均访问：{typeof overview.avgPages === 'number' ? overview.avgPages.toFixed(1) : '0.0'} 页</li>
                <li>平均停留：{typeof overview.avgDuration === 'number' ? overview.avgDuration.toFixed(1) : '0.0'} 分钟</li>
              </ul>
              <p>📈 <strong>访问趋势</strong></p>
              <ul>
                <li>最近7天PV：{statsData.reduce((sum, item) => sum + item.pv, 0)} 次</li>
                <li>最近7天UV：{statsData.reduce((sum, item) => sum + item.uv, 0)} 人</li>
              </ul>
              <p>🏆 <strong>最活跃项目</strong></p>
              <ul>
                {topProjects.slice(0, 2).map(project => (
                  <li key={project.projectName}>
                    {project.projectName}: {project.visitCount} 次访问
                  </li>
                ))}
              </ul>
              <Button 
                type="link" 
                onClick={() => setShowHelp(false)}
                style={{ padding: 0, marginTop: 8 }}
              >
                关闭面板
              </Button>
            </div>
          </FloatingPanel>
        )}

        <div style={{ marginBottom: 16 }}>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? '隐藏帮助' : '显示帮助'}
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <EyeOutlined style={{ color: '#1890ff' }} />
                    <span>今日PV</span>
                    <Badge count={overview.todayPV > 1000 ? 'HOT' : 0} style={{ backgroundColor: '#52c41a' }} />
                  </Space>
                }
                value={overview.todayPV}
                suffix="次"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <UserOutlined style={{ color: '#52c41a' }} />
                    <span>今日UV</span>
                    <Badge count={overview.todayUV > 500 ? 'NEW' : 0} style={{ backgroundColor: '#fa8c16' }} />
                  </Space>
                }
                value={overview.todayUV}
                suffix="人"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#722ed1' }} />
                    <span>人均访问页面</span>
                  </Space>
                }
                value={overview.avgPages}
                precision={2}
                suffix="页"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                    <span>平均停留时间</span>
                  </Space>
                }
                value={overview.avgDuration}
                precision={1}
                suffix="分钟"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <Card 
          title={
            <Space>
              <LineChartOutlined style={{ color: '#1890ff' }} />
              <span>访问趋势</span>
            </Space>
          } 
          style={{ marginTop: 16 }}
        >
          <Suspense fallback={<div>图表加载中...</div>}>
            <Line {...lineConfig} />
          </Suspense>
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <TrophyOutlined style={{ color: '#fa8c16' }} />
                  <span>Top 5 访问项目</span>
                  <Badge count={topProjects.length} style={{ backgroundColor: '#52c41a' }} />
                </Space>
              }
            >
              <Table
                dataSource={topProjects}
                columns={topProjectsColumns}
                rowKey="projectName"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  );
};

export default Dashboard; 