import { Avatar, Typography } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { ChatMessage } from 'shared';
import ReferenceCard from './ReferenceCard';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

/**
 * 单条消息气泡：用户消息右对齐（蓝色），AI 消息左对齐（灰色）。
 * 支持流式打字效果（光标闪烁）和引用来源展示。
 */
export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'USER';

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          background: isUser ? '#1677ff' : '#52c41a',
          flexShrink: 0,
        }}
      />
      <div style={{ maxWidth: '70%' }}>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: isUser ? '#1677ff' : '#f5f5f5',
            color: isUser ? '#fff' : '#000',
          }}
        >
          <Typography.Paragraph
            style={{ margin: 0, whiteSpace: 'pre-wrap' }}
          >
            {message.content}
            {isStreaming && (
              <span className="cursor-blink">|</span>
            )}
          </Typography.Paragraph>
        </div>
        {message.references && message.references.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {message.references.map((ref, i) => (
              <ReferenceCard key={i} reference={ref} index={i + 1} />
            ))}
          </div>
        )}
        {message.token_usage && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tokens: {message.token_usage.prompt_tokens} prompt +{' '}
            {message.token_usage.completion_tokens} completion
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
