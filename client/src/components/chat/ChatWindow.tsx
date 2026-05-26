import { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography } from 'antd';
import { SendOutlined, RobotOutlined } from '@ant-design/icons';
import type { ChatMessage } from 'shared';
import MessageBubble from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  onSend: (content: string) => void;
}

/**
 * 聊天窗口 — 消息列表 + 流式输出 + 底部输入区。
 * 空状态展示品牌欢迎页，消息自动滚动到底部。
 */
export default function ChatWindow({
  messages,
  streaming,
  streamContent,
  onSend,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || streaming) return;
    setInputValue('');
    onSend(text);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 消息区 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 28px',
          background: '#fafaf8',
        }}
      >
        {messages.length === 0 && !streaming ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #fdf6e8, #faf0d7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RobotOutlined style={{ fontSize: 32, color: '#b8860b' }} />
            </div>
            <Typography.Text
              style={{ fontSize: 15, color: '#999' }}
            >
              基于知识库内容，向 AI 助手提问
            </Typography.Text>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* 流式生成中的临时气泡 */}
        {streaming && streamContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              session_id: '',
              role: 'ASSISTANT',
              content: streamContent,
              references: null,
              token_usage: null,
              created_at: '',
            }}
            isStreaming
          />
        )}
      </div>

      {/* 输入区 */}
      <div className="chat-input-area">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={streaming}
            style={{ borderRadius: 10, fontSize: 14 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={streaming}
            style={{
              height: 40,
              width: 48,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: streaming
                ? undefined
                : 'linear-gradient(135deg, #b8860b, #d4a017)',
              border: 'none',
            }}
          />
        </div>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, marginTop: 8, display: 'block' }}
        >
          AI 回答基于知识库内容生成，请核实关键信息
        </Typography.Text>
      </div>
    </div>
  );
}
