import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { store } from './store';
import App from './App';
import './index.css';

/**
 * 自定义 Ant Design 主题 token。
 * 暖金色主色调，深石板灰侧边栏，柔和的圆角和阴影营造精致感。
 */
const theme = {
  token: {
    colorPrimary: '#b8860b',
    colorSuccess: '#4a9e6e',
    colorWarning: '#d4a017',
    colorError: '#c0392b',
    colorInfo: '#5b7a8a',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#fafaf8',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif",
    boxShadow:
      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    boxShadowSecondary:
      '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  },
  components: {
    Layout: {
      siderBg: '#1e1f24',
      triggerBg: '#2a2b30',
    },
    Menu: {
      darkItemBg: '#1e1f24',
      darkItemSelectedBg: '#b8860b',
      darkSubMenuItemBg: '#1e1f24',
    },
    Card: {
      borderRadiusLG: 12,
    },
    Button: {
      borderRadius: 7,
      controlHeight: 38,
    },
    Input: {
      borderRadius: 7,
      controlHeight: 38,
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider theme={theme} locale={zhCN}>
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </Provider>
  </React.StrictMode>,
);
