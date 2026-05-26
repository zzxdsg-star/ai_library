import { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../store/authSlice';
import type { AppDispatch, RootState } from '../store';

const { Title } = Typography;

/**
 * 登录页：用户名 + 密码，登录后自动跳转首页。
 */
export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { token, loading } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await dispatch(login(values)).unwrap();
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err?.message || '登录失败');
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
          AI 知识库管理平台
        </Title>
        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            还没有账号？<Link to="/register">注册</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
