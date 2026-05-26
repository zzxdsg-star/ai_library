import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Row,
  Col,
  Typography,
  Empty,
  App,
} from 'antd';
import {
  PlusOutlined,
  BookOutlined,
  DeleteOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '../store';
import {
  fetchKBList,
  createKB,
  deleteKB,
} from '../store/knowledgeBaseSlice';

const { TextArea } = Input;

/**
 * 首页 — 知识库卡片网格。
 * 卡片悬停有抬升效果（CSS class "kb-card"）、入场淡入动画。
 */
export default function KnowledgeBaseList() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { list, loading } = useSelector((s: RootState) => s.knowledgeBase);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchKBList(1));
  }, [dispatch]);

  const handleCreate = async (values: {
    name: string;
    description?: string;
    system_prompt?: string;
  }) => {
    try {
      await dispatch(createKB(values)).unwrap();
      message.success('知识库创建成功');
      setModalOpen(false);
      form.resetFields();
    } catch (err: unknown) {
      message.error(
        (err as { message?: string })?.message || '创建失败',
      );
    }
  };

  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: '确认删除',
      okText: '确认',
      cancelText: '取消', 
      content: `确定要删除知识库「${name}」吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await dispatch(deleteKB(id));
        message.success('已删除');
      },
    });
  };

  return (
    <div>
      {/* 页头 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            我的知识库
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {list.length > 0
              ? `共 ${list.length} 个知识库`
              : '创建你的第一个知识库'}
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{
            height: 42,
            borderRadius: 8,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #b8860b, #c9940e)',
            border: 'none',
          }}
        >
          新建知识库
        </Button>
      </div>

      {/* 卡片网格 */}
      {list.length === 0 && !loading ? (
        <Empty
          description="暂无知识库，点击上方按钮创建"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[20, 20]}>
          {list.map((kb, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={kb.id}>
              <Card
                className="kb-card kb-card-enter"
                style={{
                  animationDelay: `${i * 0.06}s`,
                  height: '100%',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                styles={{ body: { padding: '22px 20px 18px' } }}
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
                actions={[
                  <DeleteOutlined
                    key="delete"
                    style={{ color: '#c0392b' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(kb.id, kb.name);
                    }}
                  />,
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #fdf6e8, #faf0d7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BookOutlined style={{ fontSize: 20, color: '#b8860b' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text
                      strong
                      ellipsis
                      style={{ fontSize: 15, display: 'block', marginBottom: 4 }}
                    >
                      {kb.name}
                    </Typography.Text>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ fontSize: 13, marginBottom: 0 }}
                      ellipsis={{ rows: 2 }}
                    >
                      {kb.description || '暂无描述'}
                    </Typography.Paragraph>
                    {kb.system_prompt && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: '#b8860b',
                          background: '#fdf6e8',
                          padding: '2px 8px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        已配置 AI 人设
                      </div>
                    )}
                  </div>
                  <RightOutlined
                    style={{ color: '#ccc', marginTop: 10, flexShrink: 0 }}
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 新建 Modal */}
      <Modal
        title="新建知识库"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="输入知识库名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="简要描述知识库内容" />
          </Form.Item>
          <Form.Item
            name="system_prompt"
            label="AI 人设提示词"
            help="定义 AI 助手的角色和回答风格"
          >
            <TextArea
              rows={3}
              placeholder="例如：你是一个前端技术专家，擅长解答 React 和 TypeScript 相关问题..."
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              onClick={() => setModalOpen(false)}
              style={{ marginRight: 12 }}
            >
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
