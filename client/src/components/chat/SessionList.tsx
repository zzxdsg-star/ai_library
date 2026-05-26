import { List, Button, Typography, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import type { ChatSession } from 'shared';

interface Props {
  sessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

/**
 * 左侧会话列表，支持新建、切换、删除会话。
 */
export default function SessionList({
  sessions,
  currentId,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
        <Button type="primary" icon={<PlusOutlined />} block onClick={onCreate}>
          新对话
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <List
          dataSource={sessions}
          renderItem={(s) => (
            <List.Item
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: s.id === currentId ? '#e6f4ff' : undefined,
              }}
              onClick={() => onSelect(s.id)}
              actions={[
                <Popconfirm
                  key="del"
                  title="删除该对话？"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDelete(s.id);
                  }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<MessageOutlined />}
                title={
                  <Typography.Text ellipsis style={{ width: 160 }}>
                    {s.title}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
