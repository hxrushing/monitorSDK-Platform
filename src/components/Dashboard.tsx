import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Select, Row, Col } from 'antd';
import { Line } from '@ant-design/plots';
import dayjs, { Dayjs } from 'dayjs';
import type { EventStats } from '@/types';

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

  const lineConfig = {
    data: stats,
    xField: 'date',
    yField: 'pv',
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
            <Line {...lineConfig} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 