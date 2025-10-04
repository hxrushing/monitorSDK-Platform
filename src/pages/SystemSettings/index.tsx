import React, { useMemo, useState } from 'react';
import { Card, Form, Input, Button, Space, message, Segmented, ColorPicker, Select, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import useGlobalStore from '@/store/globalStore';

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [logoLoading, setLogoLoading] = useState(false);
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

  const handleLogoUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB！');
      return false;
    }

    setLogoLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      form.setFieldValue('logoUrl', base64);
      setLogoLoading(false);
      message.success('Logo 上传成功');
    };
    reader.onerror = () => {
      setLogoLoading(false);
      message.error('Logo 上传失败');
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传
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
          <Form.Item name="logoUrl" label="Logo">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                beforeUpload={handleLogoUpload}
                showUploadList={false}
                accept="image/jpeg,image/jpg,image/png"
              >
                <Button icon={<UploadOutlined />} loading={logoLoading}>
                  上传 Logo (JPG/PNG, 最大2MB)
                </Button>
              </Upload>
              {/* <Input 
                placeholder="或粘贴图片链接，留空将使用默认 Logo" 
                onChange={(e) => form.setFieldValue('logoUrl', e.target.value)}
              /> */}
              {form.getFieldValue('logoUrl') && (
                <div style={{ marginTop: 8 }}>
                  <img 
                    src={form.getFieldValue('logoUrl')} 
                    alt="Logo 预览" 
                    style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain' }}
                  />
                </div>
              )}
            </Space>
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