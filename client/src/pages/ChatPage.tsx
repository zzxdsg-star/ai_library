import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, App, Tooltip } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { AppDispatch, RootState } from '../store';
import {
  fetchSessions,
  createSession,
  fetchMessages,
  deleteSession,
  addMessage,
  resetChat,
} from '../store/chatSlice';
import { chatApi } from '../api/chat.api';
import { useSSE } from '../hooks/useSSE';
import SessionList from '../components/chat/SessionList';
import ChatWindow from '../components/chat/ChatWindow';
import type { ChatMessage } from 'shared';

export default function ChatPage() {
  const { id, sid } = useParams<{ id: string; sid?: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { sessions, currentSessionId, messages } = useSelector(
    (s: RootState) => s.chat,
  );
  const { streaming, streamContent, startStream } = useSSE();
  const { message } = App.useApp();
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      const res = await chatApi.extractKnowledge(id, sid);
      if (res.code === 0) {
        if (res.data.count > 0) {
          message.success(`成功提炼 ${res.data.count} 条新知识`);
        } else {
          message.info(res.message || '未提炼到新知识');
        }
      } else {
        message.error(res.message || '提炼失败');
      }
    } catch {
      message.error('提炼失败，请重试');
    }
    setExtracting(false);
  };

  useEffect(() => {
    dispatch(resetChat());
    if (id) dispatch(fetchSessions(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (sid && id) {
      dispatch(fetchMessages({ kbId: id, sid }));
    }
  }, [sid, id, dispatch]);

  const handleCreateSession = async () => {
    const res = await dispatch(createSession(id!)).unwrap();
    navigate(`/knowledge-bases/${id}/chat/${res.id}`);
  };

  const handleSelectSession = (sid: string) => {
    navigate(`/knowledge-bases/${id}/chat/${sid}`);
  };

  const handleDeleteSession = async (sid: string) => {
    await dispatch(deleteSession({ kbId: id!, sid }));
  };

  const handleSend = async (content: string) => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      const res = await dispatch(createSession(id!)).unwrap();
      sessionId = res.id;
      navigate(`/knowledge-bases/${id}/chat/${sessionId}`);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      session_id: sessionId,
      role: 'USER',
      content,
      references: null,
      token_usage: null,
      created_at: new Date().toISOString(),
    };
    dispatch(addMessage(userMsg));

    const generator = chatApi.sendMessage(id!, sessionId, content);
    const fullContent = await startStream(generator);

    if (fullContent) {
      dispatch(fetchMessages({ kbId: id!, sid: sessionId }));
      dispatch(fetchSessions(id!));
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 116px)', gap: 0, margin: -28 }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 280,
          background: '#fff',
          borderRight: '1px solid rgba(0,0,0,0.05)',
          borderLeft: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/knowledge-bases/${id}`)}
            style={{ marginBottom: 8, color: '#666' }}
          >
            返回
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Title level={5} style={{ margin: 0 }}>对话列表</Typography.Title>
            <Tooltip title={sid ? '提炼当前对话的知识' : '提炼所有对话的知识'}>
              <Button
                type="link"
                size="small"
                icon={<ThunderboltOutlined />}
                loading={extracting}
                onClick={handleExtract}
                style={{ color: '#b8860b', fontWeight: 500 }}
              >
                提炼知识
              </Button>
            </Tooltip>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <SessionList
            sessions={sessions}
            currentId={currentSessionId}
            onSelect={handleSelectSession}
            onCreate={handleCreateSession}
            onDelete={handleDeleteSession}
          />
        </div>
      </div>

      {/* Right chat area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #fdfcfa 0%, #faf9f6 100%)',
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <ChatWindow
          messages={messages}
          streaming={streaming}
          streamContent={streamContent}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
