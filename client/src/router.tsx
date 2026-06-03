import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Spin } from 'antd';
import Layout from './components/Layout';
import { AuthGuard } from './components/AuthGuard';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const KnowledgeBaseList = lazy(() => import('./pages/KnowledgeBaseList'));
const KnowledgeEntryList = lazy(() => import('./pages/KnowledgeEntryList'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <Lazy><LoginPage /></Lazy> },
  { path: '/register', element: <Lazy><RegisterPage /></Lazy> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Lazy><KnowledgeBaseList /></Lazy> },
      { path: 'knowledge-bases/:id', element: <Lazy><KnowledgeEntryList /></Lazy> },
      { path: 'knowledge-bases/:id/chat', element: <Lazy><ChatPage /></Lazy> },
      { path: 'knowledge-bases/:id/chat/:sid', element: <Lazy><ChatPage /></Lazy> },
      { path: 'analytics', element: <Lazy><AnalyticsPage /></Lazy> },
    ],
  },
  { path: '*', element: <Lazy><NotFound /></Lazy> },
]);
