import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import type { RootState } from '../store';

/**
 * 路由守卫：无 token 时重定向到登录页。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
