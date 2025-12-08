import React, { useEffect, useState } from 'react';
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
} from 'antd';
import { ClockCircleOutlined, MailOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { apiService } from '@/services/api';
import useGlobalStore from '@/store/globalStore';
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

const AISummarySettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [setting, setSetting] = useState<SummarySetting | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);

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

  const handleSendNow = async () => {
    try {
      if (!setting) {
        message.warning('请先保存设置');
        return;
      }

      // 提示用户该操作可能需要较长时间
      message.info('正在生成并发送总结，数据量较大时可能需要1-2分钟，请耐心等待...', 5);
      
      setSending(true);
      const result = await apiService.sendAISummaryNow();
      if (result.success) {
        message.success('总结已发送，请查看您的邮箱');
      } else {
        message.error(result.error || '发送失败');
      }
    } catch (error: any) {
      console.error('发送总结失败:', error);
      // 如果是超时错误，给出更友好的提示
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        message.error('处理超时，数据量较大。请稍后重试，或减少项目数量后重试');
      } else {
        message.error(error?.response?.data?.error || '发送失败，请检查邮件配置');
      }
    } finally {
      setSending(false);
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
            >
              立即发送测试
            </Button>
          </Space>
        </Form>
      </Card>

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

