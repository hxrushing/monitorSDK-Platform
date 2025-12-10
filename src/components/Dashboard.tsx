import React, { useState, useEffect, Suspense } from 'react';
import { Card, DatePicker, Select, Row, Col, Spin } from 'antd';
// 懒加载图表组件，减少初始 bundle 大小
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import dayjs, { Dayjs } from 'dayjs';
import type { EventStats } from '@/types';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { RangePicker } = DatePicker;

interface DashboardProps {
  projectId: string;
}

const Dashboard: React.FC<DashboardProps> = ({ projectId }) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);
  const [selectedEvent, setSelectedEvent] = useState<string>();
  const [stats, setStats] = useState<EventStats[]>([]);

  useEffect(() => {
    fetchStats();
  }, [projectId, dateRange, selectedEvent]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/stats?projectId=${projectId}&startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}${
          selectedEvent ? `&eventName=${selectedEvent}` : ''
        }`
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

    // 准备图表数据并应用LTTB采样
  const chartData = stats.map(item => ({
    date: item.date,
    value: item.pv,
    type: item.type || 'PV'
  }));
  
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

  return (
    <div className="dashboard">
      <Row gutter={[16, 16]} className="dashboard-header">
        <Col span={12}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
          />
        </Col>
        <Col span={12}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择事件"
            value={selectedEvent}
            onChange={setSelectedEvent}
            allowClear
          >
            <Select.Option value="pageview">页面访问</Select.Option>
            <Select.Option value="click">点击事件</Select.Option>
          </Select>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-charts">
        <Col span={24}>
          <Card title="访问趋势">
            <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />}>
              <Line {...lineConfig} />
            </Suspense>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 