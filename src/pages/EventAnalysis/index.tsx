import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Table, Button, Spin, message } from 'antd';
import { Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import type { EventDefinition } from '@/types';
import useGlobalStore from '@/store/globalStore';

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

  const handleSearch = () => {
    fetchAnalysisData();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => {
        return text.replace('T', ' ').replace('.000Z', '');
      }
    },
    {
      title: '事件名称',
      dataIndex: 'eventName',
      key: 'eventName',
      render: (text: string) => 
        eventOptions.find(e => e.eventName === text)?.description || text,
    },
    {
      title: '触发次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
    },
    {
      title: '用户数',
      dataIndex: 'users',
      key: 'users',
      sorter: (a: any, b: any) => a.users - b.users,
    },
    {
      title: '人均触发',
      dataIndex: 'avgPerUser',
      key: 'avgPerUser',
      render: (text: number) => text.toFixed(2),
      sorter: (a: any, b: any) => a.avgPerUser - b.avgPerUser,
    },
  ];

  const lineConfig = {
    data: analysisData.map(item => ({
      date: item.date,
      value: item.count,
      type: eventOptions.find(e => e.eventName === item.eventName)?.description || item.eventName
    })),
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
    <Spin spinning={loading}>
      <div>
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              />
            </Col>
            <Col flex="auto">
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="选择要分析的事件"
                options={eventOptions.map(event => ({
                  label: event.description,
                  value: event.eventName
                }))}
                value={selectedEvents}
                onChange={setSelectedEvents}
              />
            </Col>
            <Col>
              <Button type="primary" onClick={handleSearch}>查询</Button>
            </Col>
          </Row>
        </Card>

        <Card title="事件趋势" style={{ marginTop: 16 }}>
          <Line {...lineConfig} />
        </Card>

        <Card title="事件明细" style={{ marginTop: 16 }}>
          <Table columns={columns} dataSource={analysisData} />
        </Card>
      </div>
    </Spin>
  );
};

export default EventAnalysis; 