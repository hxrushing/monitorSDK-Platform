import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Spin,
  App,
  Space,
  Radio,
  InputNumber,
  Alert,
  Badge,
  Table,
  Statistic,
  Tag
} from 'antd';
import {
  LineChartOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  HistoryOutlined
} from '@ant-design/icons';
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import { apiService } from '@/services/api';
import useGlobalStore from '@/store/globalStore';
import { useNavigate } from 'react-router-dom';
import { adaptiveChartSampling } from '@/utils/dataSampling';

const { Option } = Select;

interface PredictionResult {
  date: string;
  value: number;
}

interface PredictionResponse {
  success: boolean;
  projectId: string;
  metricType: string;
  modelType: string;
  predictions: PredictionResult[];
  historicalData?: Array<{ date: string; pv: number; uv: number }>;
  modelInfo?: any;
  error?: string;
}

const Prediction: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);
  const [loading, setLoading] = useState(false);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [mlServiceAvailable, setMlServiceAvailable] = useState<boolean | null>(null);
  const [mlServiceUrl, setMlServiceUrl] = useState<string>('');
  const healthCheckRef = useRef(false); // 防止重复检查

  // 预测参数
  const [metricType, setMetricType] = useState<'pv' | 'uv' | 'conversion_rate'>('pv');
  const [modelType, setModelType] = useState<'lstm' | 'gru'>('lstm');
  const [days, setDays] = useState<number>(7);

  // 预测结果
  const [predictionResults, setPredictionResults] = useState<Record<string, PredictionResponse>>({});
  const [batchResults, setBatchResults] = useState<any>(null);

  // 检查ML服务健康状态
  const checkMLServiceHealth = async (showMessage = true) => {
    setHealthCheckLoading(true);
    try {
      const result = await apiService.checkPredictionHealth();
      setMlServiceAvailable(result.mlServiceAvailable);
      setMlServiceUrl(result.mlServiceUrl || '');
      if (showMessage) {
        if (result.mlServiceAvailable) {
          message.success('ML预测服务连接正常');
        } else {
          message.warning('ML预测服务不可用');
        }
      }
    } catch (error) {
      console.error('检查ML服务状态失败:', error);
      setMlServiceAvailable(false);
      if (showMessage) {
        message.error('检查ML服务状态失败');
      }
    } finally {
      setHealthCheckLoading(false);
    }
  };

  useEffect(() => {
    // 防止 React StrictMode 导致的重复执行
    if (healthCheckRef.current) return;
    healthCheckRef.current = true;
    checkMLServiceHealth();
  }, []);

  // 预测单个指标
  const handlePredict = async () => {
    if (!selectedProjectId) {
      message.warning('请先选择项目');
      return;
    }

    // 确保使用最新的metricType值
    console.log('开始预测，当前指标类型:', metricType);
    
    setLoading(true);
    // 显示提示信息，告知用户预测可能需要一些时间
    const loadingMessage = message.loading('正在训练模型并进行预测，这可能需要30-60秒，请耐心等待...', 0);
    
    try {
      // 使用当前状态中的metricType
      const currentMetricType = metricType;
      console.log('发送预测请求，指标类型:', currentMetricType);
      
      // 在开始新预测前，先清除当前指标的旧结果，确保图表刷新
      setPredictionResults(prev => {
        const newResults = { ...prev };
        delete newResults[currentMetricType];
        return newResults;
      });
      
      const response = await apiService.predict({
        projectId: selectedProjectId,
        metricType: currentMetricType,
        modelType,
        days
      });
      
      const result = response.data || response;
      console.log('预测结果:', result);

      loadingMessage(); // 关闭加载提示
      
      if (result.success) {
        console.log('预测成功，指标类型:', result.metricType, '存储key:', currentMetricType);
        // 使用函数式更新，确保使用最新的状态
        setPredictionResults(prev => ({
          ...prev,
          [currentMetricType]: result  // 使用currentMetricType确保使用正确的key
        }));
        message.success(`预测完成：${getMetricName(currentMetricType)}`);
      } else {
        message.error(result.error || '预测失败');
      }
    } catch (error: any) {
      loadingMessage(); // 关闭加载提示
      console.error('预测失败:', error);
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message.error('预测超时，请稍后重试。首次预测需要训练模型，可能需要更长时间。');
      } else {
        message.error(error.response?.data?.error || '预测失败，请检查ML服务是否启动');
      }
    } finally {
      setLoading(false);
    }
  };

  // 批量预测
  const handleBatchPredict = async () => {
    if (!selectedProjectId) {
      message.warning('请先选择项目');
      return;
    }

    setLoading(true);
    // 显示提示信息，批量预测需要更长时间
    const loadingMessage = message.loading('正在批量预测多个指标，这可能需要60-120秒，请耐心等待...', 0);
    
    try {
      const response = await apiService.predictBatch({
        projectId: selectedProjectId,
        metrics: ['pv', 'uv', 'conversion_rate'],
        modelType,
        days
      });

      const result = response.data || response;
      loadingMessage(); // 关闭加载提示
      
      if (result.success) {
        setBatchResults(result);
        message.success('批量预测完成');
      } else {
        message.error(result.error || '批量预测失败');
      }
    } catch (error: any) {
      loadingMessage(); // 关闭加载提示
      console.error('批量预测失败:', error);
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message.error('批量预测超时，请稍后重试。批量预测需要训练多个模型，可能需要更长时间。');
      } else {
        message.error(error.response?.data?.error || '批量预测失败，请检查ML服务是否启动');
      }
    } finally {
      setLoading(false);
    }
  };

  // 准备图表数据
  const prepareChartData = (result: PredictionResponse) => {
    if (!result || !result.predictions || !result.historicalData) {
      return [];
    }

    const historical = result.historicalData.map(item => {
      let value = 0;
      
      if (result.metricType === 'conversion_rate') {
        // 转化率 = UV / PV
        const pv = item.pv || 0;
        const uv = item.uv || 0;
        value = pv > 0 ? uv / pv : 0;
      } else {
        // PV 或 UV 直接取值
        value = item[result.metricType as 'pv' | 'uv'] || 0;
      }
      
      return {
        date: item.date,
        value: value,
        type: '历史数据'
      };
    });

    const predictions = result.predictions.map(item => ({
      date: item.date,
      value: item.value,
      type: '预测数据'
    }));

    const allData = [...historical, ...predictions];
    
    // 使用LTTB算法进行智能采样，优化大数据量图表渲染性能
    return adaptiveChartSampling(allData, 500, 1000, 'date', 'value', 'type');
  };

  // 获取当前指标的中文名称
  const getMetricName = (metric: string) => {
    const names: Record<string, string> = {
      pv: 'PV（页面访问量）',
      uv: 'UV（独立访客）',
      conversion_rate: '独立访客率（UV/PV）'
    };
    return names[metric] || metric;
  };

  // 表格列定义（根据指标类型动态生成）
  const getPredictionColumns = (currentMetric: string) => [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '预测值',
      dataIndex: 'value',
      key: 'value',
      render: (value: number) => {
        if (currentMetric === 'conversion_rate') {
          // 转化率显示为百分比，保留2位小数
          return `${(value * 100).toFixed(2)}%`;
        }
        // PV和UV显示为整数（不使用小数）
        return Math.round(value).toLocaleString();
      },
    },
  ];

  return (
    <div>
      {/* ML服务状态提示 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>ML预测服务状态：</span>
          {mlServiceAvailable === null ? (
            <Tag color="default">检查中...</Tag>
          ) : mlServiceAvailable ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              可用
            </Tag>
          ) : (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              不可用
            </Tag>
          )}
          {mlServiceUrl && (
            <Tag color="blue">服务地址: {mlServiceUrl}</Tag>
          )}
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={healthCheckLoading}
            onClick={() => checkMLServiceHealth(true)}
          >
            刷新状态
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => navigate('/app/prediction/history')}
          >
            查看历史记录
          </Button>
        </Space>
      </Card>

      {mlServiceAvailable === false && (
        <Alert
          message="ML预测服务不可用"
          description={
            <div>
              <p>请确保ML预测服务已启动：</p>
              <ol>
                <li>进入 <code>ml-service</code> 目录</li>
                <li>安装依赖：<code>pip install -r requirements.txt</code></li>
                <li>启动服务：<code>python app.py</code></li>
              </ol>
              <p>服务默认运行在 <code>http://localhost:5000</code></p>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 预测参数配置 */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>时序预测配置</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message="提示：首次预测需要训练模型，可能需要30-60秒，请耐心等待"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>预测指标：</div>
            <Select
              value={metricType}
              onChange={(value) => {
                console.log('切换预测指标:', value);
                setMetricType(value);
                // 切换指标时，清除该指标的旧预测结果，确保图表刷新
                setPredictionResults(prev => {
                  const newResults = { ...prev };
                  // 只清除当前切换到的指标的结果，保留其他指标的结果
                  // 如果用户想对比不同指标，可以保留；如果想只看当前指标，可以删除这行
                  // delete newResults[value];
                  return newResults;
                });
              }}
              style={{ width: '100%' }}
            >
              <Option value="pv">PV（页面访问量）</Option>
              <Option value="uv">UV（独立访客）</Option>
              <Option value="conversion_rate">独立访客率（UV/PV）</Option>
            </Select>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>预测模型：</div>
            <Radio.Group
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
            >
              <Radio.Button value="lstm">LSTM</Radio.Button>
              <Radio.Button value="gru">GRU</Radio.Button>
            </Radio.Group>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>预测天数：</div>
            <InputNumber
              min={1}
              max={30}
              value={days}
              onChange={(value) => value && setDays(value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>&nbsp;</div>
            <Space>
              <Button
                type="primary"
                icon={<LineChartOutlined />}
                loading={loading}
                onClick={handlePredict}
                disabled={!mlServiceAvailable}
              >
                预测单个指标
              </Button>
              <Button
                type="default"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={handleBatchPredict}
                disabled={!mlServiceAvailable}
              >
                批量预测
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 批量预测结果 */}
      {batchResults && batchResults.success && (
        <Card
          title={
            <Space>
              <ThunderboltOutlined />
              <span>批量预测结果</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {['pv', 'uv', 'conversion_rate'].map(metric => {
              const results = batchResults.results[metric];
              if (!results) return null;

              const total = results.reduce((sum: number, item: PredictionResult) => sum + item.value, 0);
              const avg = total / results.length;

              return (
                <Col span={8} key={metric}>
                  <Card>
                    <Statistic
                      title={getMetricName(metric)}
                      value={avg}
                      precision={metric === 'conversion_rate' ? 4 : 0}
                      suffix={metric === 'conversion_rate' ? '' : '（平均）'}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Row gutter={16}>
            {['pv', 'uv', 'conversion_rate'].map(metric => {
              const results = batchResults.results[metric];
              if (!results) return null;

              const chartData = results.map((item: PredictionResult) => ({
                date: item.date,
                value: metric === 'conversion_rate' ? item.value * 100 : item.value,
                type: '预测值'
              }));

              // 使用LTTB算法进行智能采样
              const sampledChartData = adaptiveChartSampling(chartData, 500, 1000, 'date', 'value');

              return (
                <Col span={8} key={metric}>
                  <Card title={getMetricName(metric)}>
                    <Suspense fallback={<Spin />}>
                      <Line
                        data={sampledChartData}
                        xField="date"
                        yField="value"
                        smooth
                        height={200}
                        animation={false}
                        renderer={'canvas' as 'canvas'}
                      />
                    </Suspense>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* 检查当前指标和模型组合是否有预测结果 */}
      {!batchResults && (() => {
        const currentResult = predictionResults[metricType];
        const hasCurrentResult = currentResult?.success && currentResult?.modelType === modelType;

        // 如果有当前指标和模型组合的结果，显示结果
        if (hasCurrentResult) {
          const result = currentResult;
          const chartData = prepareChartData(result);
          const predictionColumns = getPredictionColumns(metricType);

          return (
            <Card
              key={`${metricType}-${modelType}`}
              title={
                <Space>
                  <LineChartOutlined />
                  <span>{getMetricName(metricType)} - {result.modelType.toUpperCase()}模型预测结果</span>
                  <Badge count={result.predictions.length} style={{ backgroundColor: '#52c41a' }} />
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={16}>
                  <Suspense fallback={<Spin />}>
                    <Line
                      key={`chart-${metricType}-${result.modelType}`}
                      data={chartData}
                      xField="date"
                      yField="value"
                      seriesField="type"
                      smooth
                      height={300}
                      point={{
                        size: 4,
                      }}
                      legend={{
                        position: 'top-right',
                      }}
                      animation={false}
                      renderer={'canvas' as 'canvas'}
                    />
                  </Suspense>
                </Col>
                <Col span={8}>
                  <Card title="预测详情" size="small">
                    <Table
                      key={`table-${metricType}-${result.modelType}`}
                      dataSource={result.predictions}
                      columns={predictionColumns}
                      pagination={false}
                      size="small"
                      rowKey="date"
                      scroll={{ y: 400 }}
                      virtual={false}
                    />
                    {result.modelInfo && (
                      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
                        <p>模型信息：</p>
                        <p>• TensorFlow可用: {result.modelInfo.tensorflowAvailable ? '是' : '否'}</p>
                        <p>• 序列长度: {result.modelInfo.sequenceLength} 天</p>
                        <p>• 训练样本数: {result.modelInfo.trainingSamples}</p>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </Card>
          );
        }

        // 如果没有当前指标和模型组合的结果，显示初始提示
        return (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <LineChartOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>请选择预测参数并点击"预测"按钮开始预测</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>
                提示：至少需要14天的历史数据才能进行预测
              </p>
            </div>
          </Card>
        );
      })()}
    </div>
  );
};

export default Prediction;

