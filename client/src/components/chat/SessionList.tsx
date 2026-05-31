import { memo } from 'react';
import { List, Button, Typography, Popconfirm } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { ChatSession } from 'shared';

interface Props {
  sessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

/**
 * 左侧会话列表。
 * 悬停时柔和背景变化，当前选中项金色左边框高亮。
 */
const SessionList = memo(function SessionList({
  sessions,
  currentId,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 14px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onCreate}
          style={{
            borderRadius: 8,
            height: 38,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #b8860b, #c9940e)',
            border: 'none',
          }}
        >
          新对话
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 6px' }}>
        <List
          dataSource={sessions}
          renderItem={(s) => {
            const active = s.id === currentId;
            return (
              <List.Item
                className="session-item"
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderLeft: active ? '3px solid #b8860b' : '3px solid transparent',
                  background: active ? '#fdf6e8' : 'transparent',
                  borderRadius: 6,
                  marginBottom: 2,
                }}
                onClick={() => onSelect(s.id)}
                actions={[
                  <Popconfirm
                    key="del"
                    title="删除该对话？"
                    okText="确认"
                    cancelText="取消"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDelete(s.id);
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <MessageOutlined
                      style={{
                        color: active ? '#b8860b' : '#999',
                        fontSize: 16,
                      }}
                    />
                  }
                  title={
                    <Typography.Text
                      ellipsis
                      style={{
                        width: 150,
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        color: active ? '#333' : '#666',
                      }}
                    >
                      {s.title}
                    </Typography.Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      </div>
    </div>
  );
});

export default SessionList;
