import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import useGlobalStore from '@/store/globalStore';
import './index.less';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUserInfo = useGlobalStore(state => state.setUserInfo);

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      const response = await apiService.login(values);
      
      if (response.success && response.user) {
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
        setUserInfo(response.user);
        message.success('登录成功');
        navigate('/app/dashboard');
      } else {
        message.error(response.error || '登录失败');
      }
    } catch (error) {
      message.error('登录失败，请稍后重试');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const siteName = useGlobalStore(state => state.siteSettings.siteName)

  return (
    <div className="login-container">
      <Card className="login-card" title={siteName}>
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>

          <Form.Item>
            <Button
              type="link"
              onClick={() => navigate('/register')}
              block
            >
              没有账号？去注册
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login; 