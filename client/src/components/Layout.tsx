import { Layout as AntLayout, Menu, Avatar, Dropdown } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  BookOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';

const { Sider, Content } = AntLayout;

/**
 * 全局布局 — 深色侧边栏 + 浅色内容区。
 * 侧边栏品牌区带金色渐变 Logo，顶部栏合并到内容区内。
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);

  const menuItems = [
    { key: '/', icon: <BookOutlined />, label: '我的知识库' },
  ];

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') dispatch(logout());
    },
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={240}
        style={{
          background: '#1e1f24',
        }}
      >
        {/* 品牌区 */}
        <div className="sider-brand">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #b8860b, #d4a017)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            AI
          </div>
          <span>AI 知识库</span>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname === '/' ? '/' : '']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', marginTop: 8, padding: '0 8px' }}
        />
      </Sider>

      <AntLayout style={{ background: '#fafaf8' }}>
        {/* 顶部栏 */}
        <div
          className="header-bar"
          style={{
            height: 56,
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 28px',
          }}
        >
          <Dropdown menu={userMenu} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#fafaf8')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ background: '#b8860b' }}
              />
              <span style={{ fontWeight: 500, color: '#333' }}>
                {user?.username}
              </span>
            </div>
          </Dropdown>
        </div>

        <Content style={{ margin: '24px 28px', minHeight: 280 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
