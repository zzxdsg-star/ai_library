import { Avatar, Typography } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from 'shared';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'USER';

  return (
    <div
      className="msg-enter"
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 18,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        size={36}
        style={{
          background: isUser
            ? 'linear-gradient(135deg, #b8860b, #d4a017)'
            : 'linear-gradient(135deg, #4a9e6e, #5bb87a)',
          flexShrink: 0,
          boxShadow: isUser
            ? '0 2px 8px rgba(184,134,11,0.3)'
            : '0 2px 8px rgba(74,158,110,0.3)',
        }}
      />
      <div style={{ maxWidth: '72%' }}>
        <div
          style={{
            padding: '12px 18px',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background: isUser
              ? 'linear-gradient(135deg, #b8860b, #c9940e)'
              : '#f5f3ef',
            color: isUser ? '#fff' : '#333',
            fontSize: 14,
            lineHeight: 1.7,
            ...(isUser
              ? { boxShadow: '0 2px 6px rgba(184,134,11,0.15)' }
              : { borderLeft: '3px solid #b8860b' }),
          }}
        >
          {isUser ? (
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography.Paragraph>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="cursor-blink">|</span>}
            </div>
          )}
        </div>
        {message.token_usage && (
          <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
            {message.token_usage.prompt_tokens} prompt + {message.token_usage.completion_tokens} completion tokens
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
