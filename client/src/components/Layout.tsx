import { Layout as AntLayout, Menu, Button, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { BookOutlined, LogoutOutlined } from '@ant-design/icons';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';

const { Header, Sider, Content } = AntLayout;

/**
 * 全局布局：左侧导航 + 顶部用户栏 + 内容区。
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = [{ key: '/', icon: <BookOutlined />, label: '知识库' }];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div
          style={{
            height: 48,
            margin: 16,
            color: '#fff',
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            lineHeight: '48px',
          }}
        >
          AI 知识库
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname === '/' ? '/' : '']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <span style={{ marginRight: 16 }}>{user?.username}</span>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => dispatch(logout())}
          >
            退出
          </Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
