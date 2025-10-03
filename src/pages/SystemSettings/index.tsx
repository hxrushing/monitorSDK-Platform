import React, { useMemo } from 'react';
import { Card, Form, Input, Button, Space, message, Segmented, ColorPicker, Select } from 'antd';
import useGlobalStore from '@/store/globalStore';

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const siteSettings = useGlobalStore(state => state.siteSettings);
  const setSiteSettings = useGlobalStore(state => state.setSiteSettings);
  const themeMode = useGlobalStore(state => state.themeMode);
  const setThemeMode = useGlobalStore(state => state.setThemeMode);

  const initialValues = useMemo(() => ({
    siteName: siteSettings.siteName,
    organizationName: siteSettings.organizationName,
    logoUrl: siteSettings.logoUrl,
    primaryColor: siteSettings.primaryColor,
    componentSize: siteSettings.componentSize,
    themeMode
  }), [siteSettings, themeMode]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSiteSettings({
        siteName: values.siteName,
        organizationName: values.organizationName,
        logoUrl: values.logoUrl,
        primaryColor: typeof values.primaryColor === 'string' ? values.primaryColor : values.primaryColor.toHexString?.() || siteSettings.primaryColor,
        componentSize: values.componentSize
      });
      setThemeMode(values.themeMode);
      message.success('已保存系统设置');
    } catch (e) {}
  };

  const handleReset = () => {
    form.setFieldsValue(initialValues);
    message.info('已恢复表单为当前生效值');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="基础配置">
        <Form form={form} layout="vertical" initialValues={initialValues}>
          <Form.Item name="siteName" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input placeholder="例如：埋点分析平台" />
          </Form.Item>
          <Form.Item name="organizationName" label="组织名称" rules={[{ required: true, message: '请输入组织名称' }]}>
            <Input placeholder="例如：Demo Org" />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL">
            <Input placeholder="粘贴图片链接，留空将使用默认 Logo" />
          </Form.Item>
        </Form>
      </Card>

      <Card title="主题与外观">
        <Form form={form} layout="vertical" initialValues={initialValues}>
          <Form.Item name="themeMode" label="主题模式">
            <Segmented
              options={[{ label: '浅色', value: 'light' }, { label: '暗色', value: 'dark' }]}
            />
          </Form.Item>
          <Form.Item name="primaryColor" label="主色">
            <ColorPicker format="hex" />
          </Form.Item>
          <Form.Item name="componentSize" label="组件尺寸">
            <Select
              options={[
                { label: '紧凑', value: 'small' },
                { label: '默认', value: 'middle' },
                { label: '宽松', value: 'large' }
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Space>
        <Button type="primary" onClick={handleSave}>保存</Button>
        <Button onClick={handleReset}>重置</Button>
      </Space>
    </Space>
  );
};

export default SystemSettings;


