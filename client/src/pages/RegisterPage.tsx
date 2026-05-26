import { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { register } from '../store/authSlice';
import type { AppDispatch, RootState } from '../store';

const { Title, Text } = Typography;

/**
 * 注册页 — 与登录页统一风格，暖金渐变背景 + 精致卡片。
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
      message.success('注册成功，欢迎！');
      navigate('/');
    } catch (err: unknown) {
      message.error(
        (err as { message?: string })?.message || '注册失败',
      );
    }
  };

  return (
    <div className="auth-bg">
      <Card
        style={{
          width: 420,
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          border: '1px solid rgba(184,134,11,0.1)',
        }}
        styles={{ body: { padding: '40px 36px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={3} style={{ margin: '0 0 4px' }}>
            创建账号
          </Title>
          <Text type="secondary">加入 AI 知识库平台</Text>
        </div>

        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#b8860b' }} />}
              placeholder="用户名"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[
              { required: true, type: 'email', message: '请输入有效的邮箱' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#b8860b' }} />}
              placeholder="邮箱"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, min: 6, message: '密码至少6位' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#b8860b' }} />}
              placeholder="密码"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #b8860b, #d4a017)',
                border: 'none',
              }}
            >
              注 册
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary">
            已有账号？<Link to="/login">立即登录</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
}
