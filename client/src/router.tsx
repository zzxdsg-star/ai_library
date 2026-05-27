import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthGuard } from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import KnowledgeBaseList from './pages/KnowledgeBaseList';
import KnowledgeEntryList from './pages/KnowledgeEntryList';
import ChatPage from './pages/ChatPage';
import AnalyticsPage from './pages/AnalyticsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <KnowledgeBaseList /> },
      { path: 'knowledge-bases/:id', element: <KnowledgeEntryList /> },
      { path: 'knowledge-bases/:id/chat', element: <ChatPage /> },
      { path: 'knowledge-bases/:id/chat/:sid', element: <ChatPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
