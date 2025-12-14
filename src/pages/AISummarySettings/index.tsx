import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Form,
  Switch,
  TimePicker,
  Input,
  Button,
  message,
  Space,
  Select,
  Typography,
  Alert,
  Divider,
  Progress,
  Spin,
} from 'antd';
import { MailOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import type { Project } from '@/services/api';

const { Title, Text } = Typography;

interface SummarySetting {
  id: string;
  userId: string;
  enabled: boolean;
  sendTime: string;
  email: string | null;
  projectIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface SummaryProgress {
  taskId: string;
  userId: string;
  status: 'pending' | 'collecting' | 'generating' | 'sending' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  totalProjects: number;
  processedProjects: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

const AISummarySettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [setting, setSetting] = useState<SummarySetting | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [progress, setProgress] = useState<SummaryProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 加载设置和项目列表
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingData, projectsData] = await Promise.all([
        apiService.getAISummarySettings(),
        apiService.getProjects(),
      ]);
      
      setSetting(settingData);
      setProjects(projectsData);

      // 设置表单初始值
      if (settingData) {
        const time = settingData.sendTime ? dayjs(settingData.sendTime, 'HH:mm:ss') : dayjs('09:00', 'HH:mm');
        form.setFieldsValue({
          enabled: settingData.enabled,
          sendTime: time,
          email: settingData.email || '',
          projectIds: settingData.projectIds || [],
        });
      } else {
        // 默认值
        form.setFieldsValue({
          enabled: true,
          sendTime: dayjs('09:00', 'HH:mm'),
          email: '',
          projectIds: [],
        });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const sendTime = values.sendTime.format('HH:mm:ss');
      const result = await apiService.updateAISummarySettings({
        enabled: values.enabled,
        sendTime,
        email: values.email || undefined,
        projectIds: values.projectIds && values.projectIds.length > 0 ? values.projectIds : undefined,
      });

      setSetting(result);
      message.success('设置已保存');
    } catch (error: any) {
      console.error('保存设置失败:', error);
      message.error(error?.response?.data?.error || '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // 使用 Server-Sent Events 监听进度
  const connectProgressStream = (taskId: string) => {
    // 关闭之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 获取 token
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未登录，请先登录');
      setSending(false);
      return;
    }

    // 构建 SSE URL（EventSource 不支持自定义 headers，所以通过 URL 参数传递 token）
    // 获取 API base URL（从 http 工具或环境变量）
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    
    // 构建完整的 URL
    // 如果 apiBaseUrl 已经包含 /api，直接使用；否则添加 /api
    let baseUrl = apiBaseUrl;
    if (!baseUrl.endsWith('/api')) {
      // 移除末尾的斜杠（如果有）
      baseUrl = baseUrl.replace(/\/$/, '');
      baseUrl = baseUrl + '/api';
    }
    
    const url = `${baseUrl}/ai-summary/progress/${taskId}/stream?token=${encodeURIComponent(token)}`;
    
    console.log('[SSE] 连接 URL:', url.replace(/token=[^&]+/, 'token=***')); // 隐藏 token 日志
    
    // 创建 EventSource
    const eventSource = new EventSource(url);

    // 连接打开
    eventSource.onopen = () => {
      console.log('[SSE] 连接已建立');
    };

    // 接收消息
    eventSource.onmessage = (event) => {
      try {
        console.log('[SSE] 收到消息:', event.data);
        const data = JSON.parse(event.data);
        if (data.success && data.data) {
          setProgress(data.data);
          console.log('[SSE] 进度更新:', data.data.status, data.data.progress + '%');

          // 如果任务完成或失败，关闭连接
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            console.log('[SSE] 任务完成，关闭连接');
            eventSource.close();
            eventSourceRef.current = null;
            setSending(false);

            if (data.data.status === 'completed') {
              message.success('总结已发送，请查看您的邮箱');
            } else {
              message.error(data.data.error || '生成总结失败');
            }
          }
        }
      } catch (error) {
        console.error('[SSE] 解析进度数据失败:', error, event.data);
      }
    };

    // 监听服务器发送的错误事件（自定义事件）
    eventSource.addEventListener('error', (event: MessageEvent) => {
      console.error('[SSE] 收到服务器错误事件:', event);
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        if (data && data.error) {
          console.error('[SSE] 服务器错误:', data.error);
          message.error(`连接失败: ${data.error}`);
          eventSource.close();
          eventSourceRef.current = null;
          setSending(false);
        }
      } catch (error) {
        console.error('[SSE] 解析错误事件数据失败:', error);
      }
    });

    // 监听关闭事件
    eventSource.addEventListener('close', (event: MessageEvent) => {
      console.log('[SSE] 收到关闭事件:', event);
      try {
        const data = event.data ? JSON.parse(event.data) : null;
        if (data && data.data) {
          setProgress(data.data);
        }
      } catch (error) {
        console.error('[SSE] 解析关闭事件数据失败:', error);
      }
      eventSource.close();
      eventSourceRef.current = null;
      setSending(false);
    });

    // 连接错误（网络错误或连接失败）
    eventSource.onerror = (error) => {
      console.error('[SSE] 连接错误:', error);
      console.error('[SSE] EventSource readyState:', eventSource.readyState);
      console.error('[SSE] EventSource URL:', eventSource.url);
      
      // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
      if (eventSource.readyState === EventSource.CLOSED) {
        // 连接已关闭，可能是服务器关闭或网络错误
        console.log('[SSE] 连接已关闭，readyState:', eventSource.readyState);
        eventSource.close();
        eventSourceRef.current = null;
        
        // 如果任务还在进行中，降级到轮询
        if (progress && progress.status !== 'completed' && progress.status !== 'failed') {
          console.log('[SSE] 连接关闭，降级到轮询模式');
          message.warning('实时连接中断，切换到轮询模式');
          fallbackToPolling(taskId);
        } else {
          setSending(false);
        }
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // 仍在连接中，可能是网络问题
        console.log('[SSE] 仍在连接中...');
      }
    };

    eventSourceRef.current = eventSource;
  };

  // 降级到轮询（当 SSE 不可用时）
  const fallbackToPolling = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await apiService.getSummaryProgress(taskId) as any;
        if (result?.success && result?.data) {
          setProgress(result.data);

          if (result.data.status === 'completed' || result.data.status === 'failed') {
            clearInterval(pollInterval);
            setSending(false);

            if (result.data.status === 'completed') {
              message.success('总结已发送，请查看您的邮箱');
            } else {
              message.error(result.data.error || '生成总结失败');
            }
          }
        } else {
          clearInterval(pollInterval);
          setSending(false);
          setProgress(null);
        }
      } catch (error) {
        console.error('轮询进度失败:', error);
      }
    }, 2000);

    // 组件卸载时清理
    return () => clearInterval(pollInterval);
  };

  const handleSendNow = async () => {
    try {
      if (!setting) {
        message.warning('请先保存设置');
        return;
      }
      
      setSending(true);
      setProgress(null);
      
      const result = await apiService.sendAISummaryNow() as any;
      if (result?.success && result?.taskId) {
        // 连接 SSE 进度流
        connectProgressStream(result.taskId);
        message.info('总结生成任务已启动，正在处理...', 3);
      } else {
        message.error(result?.error || '启动任务失败');
        setSending(false);
      }
    } catch (error: any) {
      console.error('发送总结失败:', error);
      setSending(false);
      setProgress(null);
      
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        message.error('请求超时，请稍后重试');
      } else {
        message.error(error?.response?.data?.error || '发送失败，请检查邮件配置');
      }
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>AI 智能总结设置</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
        配置每日数据总结的发送时间和接收邮箱。系统将使用 AI 分析您的数据并生成专业的总结报告。
      </Text>

      <Alert
        message="配置说明"
        description={
          <div>
            <p>• 系统会在每天指定的时间自动发送前一日的数据总结</p>
            <p>• 如果不指定项目，将总结所有项目的数据</p>
            <p>• 如果不指定邮箱，将使用您注册时的邮箱</p>
            <p>• 需要配置 SMTP 邮件服务才能正常发送邮件</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Card loading={loading}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="enabled"
            label="启用每日总结"
            valuePropName="checked"
          >
            <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
          </Form.Item>

          <Form.Item
            name="sendTime"
            label="发送时间"
            rules={[{ required: true, message: '请选择发送时间' }]}
          >
            <TimePicker
              format="HH:mm"
              style={{ width: '100%' }}
              placeholder="选择每日发送时间"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="接收邮箱"
            extra="留空将使用您注册时的邮箱"
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="输入接收邮箱地址（可选）"
              type="email"
            />
          </Form.Item>

          <Form.Item
            name="projectIds"
            label="指定项目"
            extra="留空将总结所有项目的数据"
          >
            <Select
              mode="multiple"
              placeholder="选择要总结的项目（可选）"
              options={projects.map((p) => ({
                label: p.name,
                value: p.id,
              }))}
              allowClear
            />
          </Form.Item>

          <Divider />

          <Space>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              icon={<CheckCircleOutlined />}
            >
              保存设置
            </Button>
            <Button
              onClick={handleSendNow}
              loading={sending}
              icon={<MailOutlined />}
              disabled={sending}
            >
              立即发送测试
            </Button>
          </Space>
        </Form>
      </Card>

      {/* 进度显示 */}
      {progress && (
        <Card
          title="生成进度"
          style={{ marginTop: '24px' }}
          extra={
            progress.status === 'completed' ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
            ) : progress.status === 'failed' ? (
              <span style={{ color: '#ff4d4f' }}>失败</span>
            ) : (
              <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
            )
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Progress
                percent={progress.progress}
                status={
                  progress.status === 'failed' 
                    ? 'exception' 
                    : progress.status === 'completed' 
                    ? 'success' 
                    : 'active'
                }
                strokeColor={
                  progress.status === 'completed'
                    ? '#52c41a'
                    : progress.status === 'failed'
                    ? '#ff4d4f'
                    : '#1890ff'
                }
              />
            </div>
            
            <div>
              <Text strong>当前状态：</Text>
              <Text>
                {progress.status === 'pending' && '准备中'}
                {progress.status === 'collecting' && '收集数据'}
                {progress.status === 'generating' && '生成总结'}
                {progress.status === 'sending' && '发送邮件'}
                {progress.status === 'completed' && '已完成'}
                {progress.status === 'failed' && '失败'}
              </Text>
            </div>

            <div>
              <Text strong>当前步骤：</Text>
              <Text>{progress.currentStep}</Text>
            </div>

            {progress.totalProjects > 0 && (
              <div>
                <Text strong>项目进度：</Text>
                <Text>
                  {progress.processedProjects} / {progress.totalProjects} 个项目
                </Text>
              </div>
            )}

            {progress.error && (
              <Alert
                message="错误信息"
                description={progress.error}
                type="error"
                showIcon
              />
            )}

            {progress.status === 'completed' && (
              <Alert
                message="总结已成功发送"
                description="请查看您的邮箱，总结报告已发送完成。"
                type="success"
                showIcon
              />
            )}
          </Space>
        </Card>
      )}

      {setting && (
        <Card
          title="当前设置"
          style={{ marginTop: '24px' }}
          size="small"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>状态：</Text>
              <Text>{setting.enabled ? '已启用' : '已禁用'}</Text>
            </div>
            <div>
              <Text strong>发送时间：</Text>
              <Text>{setting.sendTime}</Text>
            </div>
            <div>
              <Text strong>接收邮箱：</Text>
              <Text>{setting.email || '使用注册邮箱'}</Text>
            </div>
            <div>
              <Text strong>指定项目：</Text>
              <Text>
                {setting.projectIds && setting.projectIds.length > 0
                  ? setting.projectIds
                      .map(
                        (id) => projects.find((p) => p.id === id)?.name || id
                      )
                      .join(', ')
                  : '所有项目'}
              </Text>
            </div>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default AISummarySettings;

