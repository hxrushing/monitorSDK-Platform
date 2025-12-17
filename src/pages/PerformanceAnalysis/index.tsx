import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { Card, Row, Col, DatePicker, Select, Table, Spin, message, Space, Badge, Statistic, Tag } from 'antd';
// 懒加载图表组件，减少初始 bundle 大小
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
const Column = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Column })));
import { 
  DashboardOutlined,
  CalendarOutlined, 
  LineChartOutlined,
  TableOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import useGlobalStore from '@/store/globalStore';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { RangePicker } = DatePicker;

interface PerformanceData {
  date: string;
  metricName: string;
  avgValue: number;
  p50: number;
  p75: number;
  p95: number;
  goodRate: number;
  totalCount: number;
}

interface PerformanceSummary {
  metricName: string;
  avgValue: number;
  goodRate: number;
  totalCount: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const PerformanceAnalysis: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['FCP', 'LCP', 'CLS', 'TTFB', 'INP']);
  const [loading, setLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [summaryData, setSummaryData] = useState<PerformanceSummary[]>([]);
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);

  const metricOptions = [
    { label: 'FCP (首次内容绘制)', value: 'FCP' },
    { label: 'LCP (最大内容绘制)', value: 'LCP' },
    { label: 'CLS (累积布局偏移)', value: 'CLS' },
    { label: 'TTFB (首字节时间)', value: 'TTFB' },
    { label: 'INP (交互到下次绘制)', value: 'INP' },
  ];

  // 获取性能数据
  const fetchPerformanceData = async () => {
    if (selectedMetrics.length === 0) {
      setPerformanceData([]);
      setSummaryData([]);
      return;
    }

    try {
      setLoading(true);
      const data = await apiService.getPerformanceAnalysis({
        projectId: selectedProjectId,
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        metrics: selectedMetrics
      });
      setPerformanceData(data.details || []);
      setSummaryData(data.summary || []);
    } catch (error) {
      message.error('获取性能数据失败');
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMetrics.length > 0) {
      fetchPerformanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedMetrics, dateRange]);

  const handleDateRangeChange = useCallback((dates: any) => {
    if (dates) {
      setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
    }
  }, []);

  const handleMetricsChange = useCallback((value: string[]) => {
    setSelectedMetrics(value);
  }, []);

  // 获取评级颜色
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return '#52c41a';
      case 'needs-improvement':
        return '#faad14';
      case 'poor':
        return '#ff4d4f';
      default:
        return '#d9d9d9';
    }
  };

  // 获取评级图标
  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'needs-improvement':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'poor':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  // 格式化指标值
  const formatMetricValue = (metricName: string, value: number): string => {
    if (metricName === 'CLS') {
      return value.toFixed(3);
    }
    return value.toFixed(0);
  };

  // 格式化指标单位
  const getMetricUnit = (metricName: string): string => {
    if (metricName === 'CLS') {
      return '';
    }
    return 'ms';
  };

  // 格式化日期时间
  const formatDateTime = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    try {
      // 尝试解析日期字符串
      const date = dayjs(dateStr);
      if (date.isValid()) {
        // 如果只是日期格式（YYYY-MM-DD），添加默认时间 00:00
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return date.format('YYYY-MM-DD HH:mm');
        }
        // 如果包含时间，格式化为 YYYY-MM-DD HH:mm
        return date.format('YYYY-MM-DD HH:mm');
      }
    } catch (error) {
      console.warn('日期格式化失败:', dateStr, error);
    }
    return dateStr;
  }, []);

  // 准备趋势图表数据
  const trendChartData = useMemo(() => {
    return performanceData.map(item => ({
      date: formatDateTime(item.date),
      value: item.avgValue,
      type: item.metricName
    }));
  }, [performanceData, formatDateTime]);

  // 使用LTTB算法进行智能采样
  const sampledTrendData = useMemo(() => {
    return adaptiveChartSampling(trendChartData, 500, 1000, 'date', 'value', 'type');
  }, [trendChartData]);

  const trendChartConfig = useMemo(() => ({
    data: sampledTrendData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: false,
    renderer: ('canvas' as 'canvas'),
    point: {
      size: 3,
      shape: 'circle',
    },
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      formatter: (datum: any) => {
        const metric = datum.type;
        const unit = getMetricUnit(metric);
        return {
          name: metric,
          value: `${formatMetricValue(metric, datum.value)}${unit}`,
        };
      },
    },
  }), [sampledTrendData]);

  // 准备分位数图表数据
  const percentileChartData = useMemo(() => {
    const result: any[] = [];
    performanceData.forEach(item => {
      const formattedDate = formatDateTime(item.date);
      result.push(
        { date: formattedDate, metric: item.metricName, type: 'P50', value: item.p50 },
        { date: formattedDate, metric: item.metricName, type: 'P75', value: item.p75 },
        { date: formattedDate, metric: item.metricName, type: 'P95', value: item.p95 },
      );
    });
    return result;
  }, [performanceData, formatDateTime]);

  const percentileChartConfig = useMemo(() => ({
    data: percentileChartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    groupField: 'metric',
    isGroup: true,
    animation: false,
    renderer: ('canvas' as 'canvas'),
    legend: {
      position: 'top' as const,
    },
  }), [percentileChartData]);

  // 表格列配置
  const columns = useMemo(() => [
    {
      title: (
        <Space>
          <ClockCircleOutlined />
          <span>日期</span>
        </Space>
      ),
      dataIndex: 'date',
      key: 'date',
      width: 160,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: (
        <Space>
          <ThunderboltOutlined />
          <span>指标</span>
        </Space>
      ),
      dataIndex: 'metricName',
      key: 'metricName',
      width: 120,
    },
    {
      title: '平均值',
      dataIndex: 'avgValue',
      key: 'avgValue',
      width: 100,
      render: (value: number, record: PerformanceData) => (
        <span>{formatMetricValue(record.metricName, value)}{getMetricUnit(record.metricName)}</span>
      ),
      sorter: (a: PerformanceData, b: PerformanceData) => a.avgValue - b.avgValue,
    },
    {
      title: 'P50',
      dataIndex: 'p50',
      key: 'p50',
      width: 100,
      render: (value: number, record: PerformanceData) => (
        <span>{formatMetricValue(record.metricName, value)}{getMetricUnit(record.metricName)}</span>
      ),
    },
    {
      title: 'P75',
      dataIndex: 'p75',
      key: 'p75',
      width: 100,
      render: (value: number, record: PerformanceData) => (
        <span>{formatMetricValue(record.metricName, value)}{getMetricUnit(record.metricName)}</span>
      ),
    },
    {
      title: 'P95',
      dataIndex: 'p95',
      key: 'p95',
      width: 100,
      render: (value: number, record: PerformanceData) => (
        <span>{formatMetricValue(record.metricName, value)}{getMetricUnit(record.metricName)}</span>
      ),
    },
    {
      title: '良好率',
      dataIndex: 'goodRate',
      key: 'goodRate',
      width: 100,
      render: (value: number) => (
        <Tag color={value >= 75 ? 'success' : value >= 50 ? 'warning' : 'error'}>
          {(value * 100).toFixed(1)}%
        </Tag>
      ),
      sorter: (a: PerformanceData, b: PerformanceData) => a.goodRate - b.goodRate,
    },
    {
      title: '样本数',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100,
      sorter: (a: PerformanceData, b: PerformanceData) => a.totalCount - b.totalCount,
    },
  ], []);

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
                <DashboardOutlined style={{ color: '#52c41a', marginRight: 8, marginTop: 8 }} />
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择要分析的性能指标"
                  options={metricOptions}
                  value={selectedMetrics}
                  onChange={handleMetricsChange}
                />
              </Space.Compact>
            </Col>
          </Row>
        </Card>

        {/* 性能概览卡片 */}
        {summaryData.length > 0 && (
          <Card 
            title={
              <Space>
                <DashboardOutlined style={{ color: '#1890ff' }} />
                <span>性能概览</span>
              </Space>
            } 
            style={{ marginTop: 16 }}
          >
            <Row gutter={[16, 16]}>
              {summaryData.map((item) => (
                <Col xs={24} sm={12} md={8} lg={4} key={item.metricName}>
                  <Card size="small">
                    <Statistic
                      title={
                        <Space>
                          {getRatingIcon(item.rating)}
                          <span>{item.metricName}</span>
                        </Space>
                      }
                      value={formatMetricValue(item.metricName, item.avgValue)}
                      suffix={getMetricUnit(item.metricName)}
                      valueStyle={{ color: getRatingColor(item.rating) }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Tag color={item.goodRate >= 75 ? 'success' : item.goodRate >= 50 ? 'warning' : 'error'}>
                        良好率: {(item.goodRate * 100).toFixed(1)}%
                      </Tag>
                      <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
                        样本数: {item.totalCount}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* 性能趋势图表 */}
        {performanceData.length > 0 && (
          <Card 
            title={
              <Space>
                <LineChartOutlined style={{ color: '#1890ff' }} />
                <span>性能趋势</span>
                <Badge count={selectedMetrics.length} style={{ backgroundColor: '#52c41a' }} />
              </Space>
            } 
            style={{ marginTop: 16 }}
          >
            <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />}>
              <Line {...trendChartConfig} />
            </Suspense>
          </Card>
        )}

        {/* 分位数分布图表 */}
        {performanceData.length > 0 && (
          <Card 
            title={
              <Space>
                <LineChartOutlined style={{ color: '#722ed1' }} />
                <span>分位数分布 (P50/P75/P95)</span>
              </Space>
            } 
            style={{ marginTop: 16 }}
          >
            <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />}>
              <Column {...percentileChartConfig} />
            </Suspense>
          </Card>
        )}

        {/* 性能明细表格 */}
        <Card 
          title={
            <Space>
              <TableOutlined style={{ color: '#722ed1' }} />
              <span>性能明细</span>
              <Badge count={performanceData.length} style={{ backgroundColor: '#fa8c16' }} />
            </Space>
          } 
          style={{ marginTop: 16 }}
        >
          <Table 
            columns={columns} 
            dataSource={performanceData}
            rowKey={(record) => `${record.date}-${record.metricName}`}
            scroll={{ y: 500 }}
            pagination={performanceData.length > 50 ? {
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

export default PerformanceAnalysis;

