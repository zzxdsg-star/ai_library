import { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { App } from 'antd';
import type { RootState } from '../store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  const { message } = App.useApp();
  const prevToken = useRef(token);

  useEffect(() => {
    if (!token) {
      const wasLogout = !!prevToken.current;
      if (!wasLogout) {
        message.error('请先登录');
      }
      prevToken.current = token;
    } else {
      prevToken.current = token;
    }
  }, [token, message]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
