import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Statistic, Spin, message, Table, Button, Space } from 'antd';
import { Line } from '@ant-design/plots';
import { QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import type { TopProject } from '@/services/api';
import FloatingPanel from '@/components/FloatingPanel';

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stats, overviewData, topProjectsData] = await Promise.all([
        apiService.getStats({
          projectId: 'demo-project',
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD')
        }),
        apiService.getDashboardOverview('demo-project'),
        apiService.getTopProjects({
          projectId: 'demo-project',
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
  }, [dateRange]);

  const lineConfig = {
    data: statsData.map(item => [
      { date: item.date, value: item.pv, type: 'PV' },
      { date: item.date, value: item.uv, type: 'UV' }
    ]).flat(),
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
                title="今日PV"
                value={overview.todayPV}
                suffix="次"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日UV"
                value={overview.todayUV}
                suffix="人"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="人均访问页面"
                value={overview.avgPages}
                precision={2}
                suffix="页"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均停留时间"
                value={overview.avgDuration}
                precision={1}
                suffix="分钟"
              />
            </Card>
          </Col>
        </Row>

        <Card title="访问趋势" style={{ marginTop: 16 }}>
          <Line {...lineConfig} />
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card title="Top 5 访问项目">
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