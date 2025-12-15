import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { Card, Row, Col, DatePicker, Statistic, Spin, message, Table, Button, Space, Badge } from 'antd';
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));
import { 
  QuestionCircleOutlined, 
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
import { ChartLoading } from '@/components/Loading';
import { DashboardSkeleton } from '@/components/Skeleton';
import StatisticCard from '@/components/StatisticCard';
import { useDataSamplingWorker } from '@/hooks/useWorker';

const { RangePicker } = DatePicker;

const Dashboard: React.FC = () => {
  // 默认显示最近30天，确保包含今天的数据
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day').startOf('day'), // 30天前（包含今天共30天）
    dayjs().endOf('day') // 今天结束时间，确保包含今天的所有数据
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
  
  // 使用 Worker 处理大数据采样
  const [sampledChartData, setSampledChartData] = useState<any[]>([]);
  const { postMessage: sampleData, isProcessing: isSampling } = useDataSamplingWorker<any[]>(
    (result) => {
      setSampledChartData(result);
    },
    {
      onError: (error) => {
        console.error('[Dashboard] Worker 采样失败:', error);
        // Worker 失败时，会在 useEffect 中自动回退到同步方式
      }
    }
  );

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) {
      return;
    }
    
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
      
      // 显示加载提示
      const hideLoading = message.loading('正在加载数据，请稍候...', 0);
      
      try {
        // 确保日期格式正确，使用 startOf('day') 和 endOf('day') 确保包含完整日期范围
        const startDate = dateRange[0].startOf('day').format('YYYY-MM-DD');
        const endDate = dateRange[1].endOf('day').format('YYYY-MM-DD');
        
        // 使用 Promise.allSettled 避免一个失败导致全部失败
        const results = await Promise.allSettled([
          apiService.getStats({
            projectId: selectedProjectId,
            startDate,
            endDate
          }),
          apiService.getDashboardOverview(selectedProjectId),
          apiService.getTopProjects({
            projectId: selectedProjectId,
            startDate,
            endDate
          })
        ]);
        
        hideLoading();
        
        // 处理统计查询结果
        if (results[0].status === 'fulfilled') {
          setStatsData(results[0].value);
        } else {
          console.error('获取统计数据失败:', results[0].reason);
          message.warning('获取统计数据失败，可能是数据量过大，请缩小查询范围');
        }
        
        // 处理概览数据
        if (results[1].status === 'fulfilled') {
          setOverview(results[1].value);
        } else {
          console.error('获取概览数据失败:', results[1].reason);
          if (results[1].reason?.code === 'ECONNABORTED') {
            message.warning('获取概览数据超时，可能是数据量过大');
          }
        }
        
        // 处理Top项目数据
        if (results[2].status === 'fulfilled') {
          setTopProjects(results[2].value);
        } else {
          console.error('获取Top项目数据失败:', results[2].reason);
        }
        
        // 如果所有请求都失败
        if (results.every(r => r.status === 'rejected')) {
          message.error('获取数据失败，请检查网络连接或缩小查询范围');
        }
      } catch (error: any) {
        hideLoading();
        if (error?.code === 'ECONNABORTED') {
          message.error('请求超时，数据量过大，请缩小查询日期范围');
        } else {
          message.error('获取数据失败: ' + (error?.message || '未知错误'));
        }
        console.error('Error fetching dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 准备图表数据 - 使用useMemo优化
  const chartData = useMemo(() => {
    return statsData.map(item => [
      { date: item.date, value: item.pv, type: 'PV' },
      { date: item.date, value: item.uv, type: 'UV' }
    ]).flat();
  }, [statsData]);
  
  // 使用 Worker 进行大数据采样，避免阻塞主线程
  useEffect(() => {
    if (chartData.length === 0) {
      setSampledChartData([]);
      return;
    }

    // 数据量小于阈值时，直接使用原数据（不采样）
    if (chartData.length <= 500) {
      setSampledChartData(chartData);
      return;
    }

    // 数据量大于阈值时，使用 Worker 进行采样
    // 如果 Worker 失败，会在 onError 中处理，这里使用 try-catch 作为额外保护
    try {
      sampleData({
        type: 'adaptive',
        payload: {
          data: chartData,
          threshold: 500,
          maxPoints: 1000,
          xField: 'date',
          yField: 'value',
          seriesField: 'type'
        }
      });
    } catch (error) {
      // Worker 不可用时，回退到同步方式
      console.warn('[Dashboard] Worker 不可用，使用同步采样:', error);
      const fallbackResult = adaptiveChartSampling(chartData, 500, 1000, 'date', 'value', 'type');
      setSampledChartData(fallbackResult);
    }
  }, [chartData, sampleData]);

  const lineConfig = useMemo(() => ({
    data: sampledChartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: false,
    renderer: ('canvas' as 'canvas'),
  }), [sampledChartData]);

  // 图表加载状态（Worker 处理中时显示加载）
  const chartLoading = isSampling && chartData.length > 500;

  const topProjectsColumns = useMemo(() => [
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
  ], []);

  // 计算统计数据 - 使用useMemo优化
  const statsSummary = useMemo(() => {
    return {
      totalPV: statsData.reduce((sum, item) => sum + item.pv, 0),
      totalUV: statsData.reduce((sum, item) => sum + item.uv, 0),
    };
  }, [statsData]);

  const handleDateRangeChange = useCallback((dates: any) => {
    if (dates && Array.isArray(dates) && dates.length === 2) {
      // 确保开始日期是当天的开始，结束日期是当天的结束
      const start = (dates[0] as dayjs.Dayjs).startOf('day');
      const end = (dates[1] as dayjs.Dayjs).endOf('day');
      // 如果结束日期是今天或未来，确保使用今天的结束时间
      const endDate = end.isAfter(dayjs()) ? dayjs().endOf('day') : end;
      setDateRange([start, endDate]);
    }
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  // 如果正在加载且没有数据，显示骨架屏
  if (loading && statsData.length === 0 && overview.todayPV === 0) {
    return <DashboardSkeleton />;
  }

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
                <li>最近7天PV：{statsSummary.totalPV} 次</li>
                <li>最近7天UV：{statsSummary.totalUV} 人</li>
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
                onClick={toggleHelp}
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
              onChange={handleDateRangeChange}
              allowClear={false}
              disabledDate={(current) => {
                // 不允许选择未来日期
                return current && current > dayjs().endOf('day');
              }}
            />
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={toggleHelp}
            >
              {showHelp ? '隐藏帮助' : '显示帮助'}
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col span={6}>
            <StatisticCard
              title={
                <Space>
                  <EyeOutlined style={{ color: '#1890ff' }} />
                  <span>今日PV</span>
                </Space>
              }
              value={overview.todayPV}
              suffix="次"
              valueStyle={{ color: '#1890ff' }}
              badge={overview.todayPV > 1000 ? { count: 'HOT', style: { backgroundColor: '#52c41a' } } : undefined}
            />
          </Col>
          <Col span={6}>
            <StatisticCard
              title={
                <Space>
                  <UserOutlined style={{ color: '#52c41a' }} />
                  <span>今日UV</span>
                </Space>
              }
              value={overview.todayUV}
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
              badge={overview.todayUV > 500 ? { count: 'NEW', style: { backgroundColor: '#fa8c16' } } : undefined}
            />
          </Col>
          <Col span={6}>
            <StatisticCard
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
          </Col>
          <Col span={6}>
            <StatisticCard
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
          </Col>
        </Row>

        <Card 
          title={
            <Space>
              <LineChartOutlined style={{ color: '#1890ff' }} />
              <span>访问趋势</span>
              {chartLoading && <Badge status="processing" text="数据处理中..." />}
            </Space>
          } 
          style={{ marginTop: 16 }}
        >
          <Spin spinning={chartLoading} tip="正在处理大数据，请稍候...">
            <Suspense fallback={<ChartLoading />}>
              {sampledChartData.length > 0 && <Line {...lineConfig} />}
            </Suspense>
          </Spin>
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