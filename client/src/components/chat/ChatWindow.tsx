import { useState, useRef, useEffect } from 'react';
import { Input, Button, Empty } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { ChatMessage } from 'shared';
import MessageBubble from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  onSend: (content: string) => void;
}

/**
 * 聊天窗口：消息列表 + 流式输出 + 输入框。
 * Enter 发送，Shift+Enter 换行，自动滚动到底部。
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
      <div
        ref={listRef}
        style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}
      >
        {messages.length === 0 && !streaming && (
          <Empty
            description="开始你的第一个问题吧"
            style={{ marginTop: 100 }}
          />
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
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
      <div
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: 12,
        }}
      >
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入问题，按 Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={streaming}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={streaming}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
