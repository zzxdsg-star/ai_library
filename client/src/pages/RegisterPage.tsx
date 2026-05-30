import { useEffect, useState, useCallback } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { register } from '../store/authSlice';
import { authApi } from '../api/auth.api';
import type { AppDispatch, RootState } from '../store';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { token, loading } = useSelector((s: RootState) => s.auth);
  const [form] = Form.useForm();
  const [captcha, setCaptcha] = useState<{ id: string; svg: string } | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await authApi.getCaptcha();
      if (res.code === 0) setCaptcha(res.data);
    } catch { /* ignore */ }
    setCaptchaLoading(false);
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const onFinish = async (values: {
    username: string;
    email: string;
    password: string;
    captchaCode?: string;
  }) => {
    try {
      await dispatch(register({
        username: values.username,
        email: values.email,
        password: values.password,
        captchaId: captcha?.id,
        captchaCode: values.captchaCode,
      })).unwrap();
      message.success('注册成功，欢迎！');
      navigate('/');
    } catch (err: unknown) {
      form.resetFields(['captchaCode']);
      fetchCaptcha();
      message.error((err as { message?: string })?.message || '注册失败');
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
          <Title level={3} style={{ margin: '0 0 4px' }}>创建账号</Title>
          <Text type="secondary">加入 AI 知识库平台</Text>
        </div>

        <Form form={form} onFinish={onFinish} size="large" validateTrigger="onBlur">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#b8860b' }} />}
              placeholder="用户名" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}>
            <Input prefix={<MailOutlined style={{ color: '#b8860b' }} />}
              placeholder="邮箱" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#b8860b' }} />}
              placeholder="密码" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="captchaCode" rules={[{ required: true, message: '请输入验证码' }]}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input prefix={<SafetyCertificateOutlined style={{ color: '#b8860b' }} />}
                placeholder="验证码" style={{ borderRadius: 8, flex: 1, height: 44 }} />
              <div
                onClick={() => !captchaLoading && fetchCaptcha()}
                style={{
                  width: 160, height: 44, borderRadius: 8, overflow: 'hidden',
                  cursor: 'pointer', border: '1px solid #e8e0d0',
                  background: '#fefdf9', display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  opacity: captchaLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#b8860b')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e8e0d0')}
                title="点击刷新验证码"
              >
                {captcha ? (
                  <div dangerouslySetInnerHTML={{ __html: captcha.svg }} />
                ) : (
                  <ReloadOutlined spin style={{ color: '#b8860b', fontSize: 20 }} />
                )}
              </div>
            </div>
          </Form.Item>
          <Form.Item style={{ marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block
              style={{
                height: 44, borderRadius: 8, fontSize: 16, fontWeight: 600,
                background: 'linear-gradient(135deg, #b8860b, #d4a017)', border: 'none',
              }}>
              注 册
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary">已有账号？<Link to="/login">立即登录</Link></Text>
        </div>
      </Card>
    </div>
  );
}
