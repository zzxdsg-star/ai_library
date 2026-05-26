import { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { register } from '../store/authSlice';
import type { AppDispatch, RootState } from '../store';

const { Title } = Typography;

/**
 * 注册页：用户名 + 邮箱 + 密码，注册后自动登录。
 */
export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { token, loading } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const onFinish = async (values: {
    username: string;
    email: string;
    password: string;
  }) => {
    try {
      await dispatch(register(values)).unwrap();
      message.success('注册成功');
      navigate('/');
    } catch (err: any) {
      message.error(err?.message || '注册失败');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center' }}>
          注册账号
        </Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, min: 6, message: '密码至少6位' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            已有账号？<Link to="/login">登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
