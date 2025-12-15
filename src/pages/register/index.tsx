import React, { useState } from 'react';
import { Form, Input, Button, Card} from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import './index.less';

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string; email: string }) => {
    try {
      setLoading(true);
      const response = await apiService.register(values);
      
      if (response.success) {
        message.success('注册成功，请登录');
        navigate('/login');
      } else {
        message.error(response.error || '注册失败');
      }
    } catch (error) {
      message.error('注册失败，请稍后重试');
      console.error('Register error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <Card className="register-card" title="用户注册">
        <Form
          name="register"
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="邮箱"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              注册
            </Button>
          </Form.Item>

          <Form.Item>
            <Button
              type="link"
              onClick={() => navigate('/login')}
              block
            >
              已有账号？去登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Register; 