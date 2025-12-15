import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { Card, Row, Col, DatePicker, Select, Table, Spin, message, Space, Badge } from 'antd';
// 懒加载图表组件，减少初始 bundle 大小
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import { 
  BarChartOutlined, 
  CalendarOutlined, 
  FilterOutlined, 
  LineChartOutlined,
  TableOutlined,
  ClockCircleOutlined,
  UserOutlined,
  NumberOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import type { EventDefinition } from '@/types';
import useGlobalStore from '@/store/globalStore';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { RangePicker } = DatePicker;

const EventAnalysis: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventOptions, setEventOptions] = useState<EventDefinition[]>([]);
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);

  // 获取事件定义列表
  const fetchEventDefinitions = async () => {
    try {
      const events = await apiService.getEventDefinitions(selectedProjectId);
      setEventOptions(events);
      setSelectedEvents(events.map(e => e.eventName));
    } catch (error) {
      message.error('获取事件列表失败');
      console.error('Error fetching event definitions:', error);
    }
  };

  // 获取分析数据
  const fetchAnalysisData = async () => {
    if (selectedEvents.length === 0) {
      setAnalysisData([]);
      return;
    }

    try {
      setLoading(true);
      // 清空旧数据
      setAnalysisData([]);
      
      const data = await apiService.getEventAnalysis({
        projectId: selectedProjectId,
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        events: selectedEvents
      });
      setAnalysisData(data);
    } catch (error) {
      message.error('获取分析数据失败');
      console.error('Error fetching analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventDefinitions();
  }, [selectedProjectId]);

  // 当项目、事件或日期范围变化时，自动刷新分析数据
  useEffect(() => {
    if (selectedEvents.length > 0) {
      fetchAnalysisData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedEvents, dateRange]);

  const handleDateRangeChange = useCallback((dates: any) => {
    if (dates) {
      setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
    }
  }, []);

  const handleEventsChange = useCallback((value: string[]) => {
    setSelectedEvents(value);
  }, []);

  // 使用 useMemo 缓存列配置，避免每次渲染都重新创建
  const columns = useMemo(() => [
    {
      title: (
        <Space>
          <ClockCircleOutlined />
          <span>时间</span>
        </Space>
      ),
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => {
        return text.replace('T', ' ').replace('.000Z', '');
      }
    },
    {
      title: (
        <Space>
          <BarChartOutlined />
          <span>事件名称</span>
        </Space>
      ),
      dataIndex: 'eventName',
      key: 'eventName',
      render: (text: string) => 
        eventOptions.find(e => e.eventName === text)?.description || text,
    },
    {
      title: (
        <Space>
          <NumberOutlined />
          <span>触发次数</span>
        </Space>
      ),
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
    },
    {
      title: (
        <Space>
          <UserOutlined />
          <span>用户数</span>
        </Space>
      ),
      dataIndex: 'users',
      key: 'users',
      sorter: (a: any, b: any) => a.users - b.users,
    },
    {
      title: (
        <Space>
          <NumberOutlined />
          <span>人均触发</span>
        </Space>
      ),
      dataIndex: 'avgPerUser',
      key: 'avgPerUser',
      render: (text: number) => text.toFixed(2),
      sorter: (a: any, b: any) => a.avgPerUser - b.avgPerUser,
    },
  ], [eventOptions]);

  // 准备图表数据并应用LTTB采样 - 使用 useMemo 优化
  const chartData = useMemo(() => {
    return analysisData.map(item => ({
      date: item.date,
      value: item.count,
      type: eventOptions.find(e => e.eventName === item.eventName)?.description || item.eventName
    }));
  }, [analysisData, eventOptions]);
  
  // 使用LTTB算法进行智能采样，优化大数据量图表渲染性能
  const sampledChartData = useMemo(() => {
    return adaptiveChartSampling(chartData, 500, 1000, 'date', 'value', 'type');
  }, [chartData]);

  const lineConfig = useMemo(() => ({
    data: sampledChartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: false,
    renderer: ('canvas' as 'canvas'),
  }), [sampledChartData]);

  return (
    <Spin spinning={loading}>
      <div>
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col>
              <Space>
                <CalendarOutlined style={{ color: '#1890ff' }} />
                <RangePicker
                  value={dateRange}
                  onChange={handleDateRangeChange}
                />
              </Space>
            </Col>
            <Col flex="auto">
              <Space.Compact style={{ width: '100%' }}>
                <FilterOutlined style={{ color: '#52c41a', marginRight: 8, marginTop: 8 }} />
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择要分析的事件"
                  options={eventOptions.map(event => ({
                    label: event.description,
                    value: event.eventName
                  }))}
                  value={selectedEvents}
                  onChange={handleEventsChange}
                />
              </Space.Compact>
            </Col>
          </Row>
        </Card>

        <Card 
          title={
            <Space>
              <LineChartOutlined style={{ color: '#1890ff' }} />
              <span>事件趋势</span>
              <Badge count={selectedEvents.length} style={{ backgroundColor: '#52c41a' }} />
            </Space>
          } 
          style={{ marginTop: 16 }}
        >
          <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />}>
            <Line {...lineConfig} />
          </Suspense>
        </Card>

        <Card 
          title={
            <Space>
              <TableOutlined style={{ color: '#722ed1' }} />
              <span>事件明细</span>
              <Badge count={analysisData.length} style={{ backgroundColor: '#fa8c16' }} />
            </Space>
          } 
          style={{ marginTop: 16 }}
        >
          <Table 
            columns={columns} 
            dataSource={analysisData}
            scroll={{ y: 500 }}
            pagination={analysisData.length > 50 ? {
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            } : false}
          />
        </Card>
      </div>
    </Spin>
  );
};

export default EventAnalysis; 