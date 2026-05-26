import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { AppDispatch, RootState } from '../store';
import {
  fetchSessions,
  createSession,
  fetchMessages,
  deleteSession,
  addMessage,
} from '../store/chatSlice';
import { chatApi } from '../api/chat.api';
import { useSSE } from '../hooks/useSSE';
import SessionList from '../components/chat/SessionList';
import ChatWindow from '../components/chat/ChatWindow';
import type { ChatMessage } from 'shared';

/**
 * 对话问答页：左侧会话列表 + 右侧聊天窗口。
 * 支持 SSE 流式输出、多轮对话、引用来源展示。
 */
export default function ChatPage() {
  const { id, sid } = useParams<{ id: string; sid?: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { sessions, currentSessionId, messages } = useSelector(
    (s: RootState) => s.chat,
  );
  const { streaming, streamContent, startStream } = useSSE();

  useEffect(() => {
    if (id) dispatch(fetchSessions(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (sid && id) {
      dispatch(fetchMessages({ kbId: id, sid }));
    }
  }, [sid, id, dispatch]);

  const handleCreateSession = async () => {
    await dispatch(createSession(id!));
    dispatch(fetchSessions(id!));
  };

  const handleSelectSession = (sid: string) => {
    dispatch(fetchMessages({ kbId: id!, sid }));
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

    // 立即显示用户消息
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

    // SSE 流式获取 AI 回答
    const generator = chatApi.sendMessage(id!, sessionId, content);
    const fullContent = await startStream(generator);

    if (fullContent) {
      // 重新加载消息和会话列表（标题可能已更新）
      dispatch(fetchMessages({ kbId: id!, sid: sessionId }));
      dispatch(fetchSessions(id!));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 112px)',
        gap: 0,
      }}
    >
      <div
        style={{
          width: 280,
          borderRight: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/knowledge-bases/${id}`)}
          >
            返回
          </Button>
        </div>
        <SessionList
          sessions={sessions}
          currentId={currentSessionId}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
        />
      </div>
      <div style={{ flex: 1 }}>
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
