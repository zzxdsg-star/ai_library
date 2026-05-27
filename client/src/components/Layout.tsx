import { Layout as AntLayout, Menu, Avatar, Dropdown, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  BookOutlined,
  LogoutOutlined,
  UserOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';

const { Sider } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);

  const menuItems = [
    {
      key: 'group-main',
      type: 'group' as const,
      label: (
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
          功能
        </span>
      ),
      children: [
        { key: '/', icon: <BookOutlined />, label: '我的知识库' },
        { key: '/analytics', icon: <BarChartOutlined />, label: '数据统计' },
      ],
    },
  ];

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') dispatch(logout());
    },
  };

  // 根据路由获取当前页面标题
  const getPageTitle = () => {
    if (location.pathname === '/') return '我的知识库';
    if (location.pathname === '/analytics') return '数据统计';
    if (location.pathname.includes('/chat')) return '对话问答';
    if (location.pathname.match(/\/knowledge-bases\/[^/]+$/)) return '知识条目管理';
    return '';
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={250}
        style={{
          background: '#2a231b',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 品牌区 */}
        <div className="sider-brand">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #b8860b 0%, #e6a817 50%, #d4a017 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(184, 134, 11, 0.3)',
              flexShrink: 0,
            }}
          >
            <ThunderboltOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>
              AI 知识库
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 0.5 }}>
              KNOWLEDGE PLATFORM
            </div>
          </div>
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname === '/' ? '/' : location.pathname.startsWith('/analytics') ? '/analytics' : '']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', marginTop: 4, padding: '0 8px' }}
        />

        {/* 底部用户信息卡 — 绝对定位贴底 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#2a231b' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              transition: 'background 0.2s',
            }}
          >
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{
                background: 'linear-gradient(135deg, #b8860b, #d4a017)',
                boxShadow: '0 2px 8px rgba(184,134,11,0.25)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
                {user?.username}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </Sider>

      <AntLayout style={{ background: '#fafaf8' }}>
        {/* Header */}
        <div
          className="header-bar"
          style={{
            height: 56,
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 28px',
          }}
        >
          {/* 左侧 — 页面标题面包屑 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DatabaseOutlined style={{ fontSize: 18, color: '#b8860b' }} />
            <Typography.Text strong style={{ fontSize: 15, color: '#333' }}>
              {getPageTitle()}
            </Typography.Text>
          </div>

          {/* 右侧 — 用户操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '6px 14px 6px 6px',
                  borderRadius: 14,
                  transition: 'all 0.2s',
                  background: 'rgba(0,0,0,0.02)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')
                }
              >
                <Avatar
                  size={34}
                  icon={<UserOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #b8860b, #d4a017)',
                    boxShadow: '0 2px 8px rgba(184,134,11,0.25)',
                  }}
                />
                <span style={{ fontWeight: 500, color: '#333', fontSize: 14 }}>
                  {user?.username}
                </span>
              </div>
            </Dropdown>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '28px 32px',
            maxWidth: 1400,
            margin: '0 auto',
            width: '100%',
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <Outlet />
        </div>
      </AntLayout>
    </AntLayout>
  );
}
