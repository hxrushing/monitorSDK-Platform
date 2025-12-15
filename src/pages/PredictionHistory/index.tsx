import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  DatePicker,
  App,
  Popconfirm,
  Tag,
  Row,
  Col,
  Statistic,
  Empty,
  Spin
} from 'antd';
import {
  HistoryOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  LineChartOutlined
} from '@ant-design/icons';
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import { apiService } from '@/services/api';
import useGlobalStore from '@/store/globalStore';
import dayjs from 'dayjs';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface PredictionRecord {
  id: string;
  projectId: string;
  userId?: string;
  metricType: 'pv' | 'uv' | 'conversion_rate';
  modelType: 'lstm' | 'gru';
  predictionDays: number;
  predictions: Array<{ date: string; value: number }>;
  historicalData?: Array<{ date: string; pv: number; uv: number }>;
  modelInfo?: any;
  createdAt: string;
  updatedAt: string;
}

const PredictionHistory: React.FC = () => {
  const { message } = App.useApp();
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);
  
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 筛选条件
  const [metricType, setMetricType] = useState<string>('');
  const [modelType, setModelType] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // 查看详情
  const [selectedRecord, setSelectedRecord] = useState<PredictionRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 获取预测记录列表
  const fetchRecords = async () => {
    if (!selectedProjectId) {
      message.warning('请先选择项目');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.getPredictionRecords({
        projectId: selectedProjectId,
        metricType: metricType || undefined,
        modelType: modelType || undefined,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        page,
        pageSize
      });

      setRecords(result.records);
      setTotal(result.total);
    } catch (error: any) {
      console.error('获取预测记录失败:', error);
      message.error('获取预测记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedProjectId, page, pageSize, metricType, modelType, dateRange]);

  // 删除记录 - 使用 useCallback 优化
  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiService.deletePredictionRecord(id);
      message.success('删除成功');
      fetchRecords();
    } catch (error: any) {
      console.error('删除记录失败:', error);
      message.error('删除失败');
    }
  }, []);

  // 查看详情 - 使用 useCallback 优化
  const handleViewDetail = useCallback(async (id: string) => {
    try {
      const record = await apiService.getPredictionRecord(id);
      setSelectedRecord(record);
      setDetailVisible(true);
    } catch (error: any) {
      console.error('获取记录详情失败:', error);
      message.error('获取记录详情失败');
    }
  }, []);

  // 筛选条件变化处理
  const handleMetricTypeChange = useCallback((value: string) => {
    setMetricType(value);
  }, []);

  const handleModelTypeChange = useCallback((value: string) => {
    setModelType(value);
  }, []);

  const handleDateRangeChange = useCallback((dates: any) => {
    setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
  }, []);

  // 获取指标名称
  const getMetricName = (metric: string) => {
    const names: Record<string, string> = {
      pv: 'PV（页面访问量）',
      uv: 'UV（独立访客）',
      conversion_rate: '独立访客率（UV/PV）'
    };
    return names[metric] || metric;
  };

  // 表格列定义 - 使用 useMemo 缓存
  const columns = useMemo(() => [
    {
      title: '预测时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
    },
    {
      title: '预测指标',
      dataIndex: 'metricType',
      key: 'metricType',
      render: (type: string) => (
        <Tag color={type === 'pv' ? 'blue' : type === 'uv' ? 'green' : 'purple'}>
          {getMetricName(type)}
        </Tag>
      ),
    },
    {
      title: '预测模型',
      dataIndex: 'modelType',
      key: 'modelType',
      render: (type: string) => (
        <Tag color="orange">{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: '预测天数',
      dataIndex: 'predictionDays',
      key: 'predictionDays',
      render: (days: number) => `${days} 天`,
    },
    {
      title: '预测值数量',
      dataIndex: 'predictions',
      key: 'predictions',
      render: (predictions: Array<any>) => predictions?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PredictionRecord) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这条预测记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], []);

  // 准备图表数据 - 使用 useMemo 优化
  const prepareChartData = useCallback((record: PredictionRecord) => {
    if (!record.predictions || !record.historicalData) {
      return [];
    }

    const historical = record.historicalData.map(item => ({
      date: item.date,
      value: item[record.metricType as 'pv' | 'uv'] || 0,
      type: '历史数据'
    }));

    const predictions = record.predictions.map(item => ({
      date: item.date,
      value: record.metricType === 'conversion_rate' ? item.value * 100 : item.value,
      type: '预测数据'
    }));

    const allData = [...historical, ...predictions];
    
    // 使用LTTB算法进行智能采样，优化大数据量图表渲染性能
    return adaptiveChartSampling(allData, 500, 1000, 'date', 'value', 'type');
  }, []);

  return (
    <div>
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>预测历史记录</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchRecords}
            loading={loading}
          >
            刷新
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>预测指标：</div>
            <Select
              value={metricType}
              onChange={handleMetricTypeChange}
              allowClear
              placeholder="全部"
              style={{ width: '100%' }}
            >
              <Option value="pv">PV（页面访问量）</Option>
              <Option value="uv">UV（独立访客）</Option>
              <Option value="conversion_rate">独立访客率（UV/PV）</Option>
            </Select>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>预测模型：</div>
            <Select
              value={modelType}
              onChange={handleModelTypeChange}
              allowClear
              placeholder="全部"
              style={{ width: '100%' }}
            >
              <Option value="lstm">LSTM</Option>
              <Option value="gru">GRU</Option>
            </Select>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 8 }}>预测时间：</div>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>

        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page: number, pageSize: number) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      {selectedRecord && detailVisible && (
        <Card
          title={
            <Space>
              <LineChartOutlined />
              <span>
                {getMetricName(selectedRecord.metricType)} - {selectedRecord.modelType.toUpperCase()}模型预测结果
              </span>
              <Tag>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Tag>
            </Space>
          }
          extra={
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic
                title="预测天数"
                value={selectedRecord.predictionDays}
                suffix="天"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="预测值数量"
                value={selectedRecord.predictions.length}
                suffix="个"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="历史数据天数"
                value={selectedRecord.historicalData?.length || 0}
                suffix="天"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="预测时间"
                value={dayjs(selectedRecord.createdAt).format('MM-DD HH:mm')}
              />
            </Col>
          </Row>

          <Suspense fallback={<Spin />}>
            <Line
              data={prepareChartData(selectedRecord)}
              xField="date"
              yField="value"
              seriesField="type"
              smooth
              height={300}
              point={{ size: 4 }}
              legend={{ position: 'top-right' }}
            />
          </Suspense>

          <Card title="预测详情" style={{ marginTop: 16 }} size="small">
            <Table
              dataSource={selectedRecord.predictions}
              columns={[
                { title: '日期', dataIndex: 'date', key: 'date' },
                {
                  title: '预测值',
                  dataIndex: 'value',
                  key: 'value',
                  render: (value: number) => {
                    if (selectedRecord.metricType === 'conversion_rate') {
                      return `${(value * 100).toFixed(2)}%`;
                    }
                    return Math.round(value).toLocaleString();
                  },
                },
              ]}
              pagination={false}
              size="small"
              rowKey="date"
              scroll={{ y: 400 }}
            />
          </Card>
        </Card>
      )}

      {records.length === 0 && !loading && (
        <Card>
          <Empty description="暂无预测记录" />
        </Card>
      )}
    </div>
  );
};

export default PredictionHistory;

