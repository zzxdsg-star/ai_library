import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Button, Modal, Form, Input, Row, Col, Typography, Empty, App, Pagination } from 'antd';
import { PlusOutlined, BookOutlined, DeleteOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '../store';
import { fetchKBList, createKB, updateKB, deleteKB, setPage } from '../store/knowledgeBaseSlice';
import type { KnowledgeBase } from 'shared';

const { TextArea } = Input;

export default function KnowledgeBaseList() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { list, total, page, loading } = useSelector((s: RootState) => s.knowledgeBase);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();

  const isEditing = !!editingKB;

  useEffect(() => {
    dispatch(fetchKBList(page));
  }, [dispatch, page]);

  const handleOpenCreate = () => {
    setEditingKB(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (kb: KnowledgeBase) => {
    setEditingKB(kb);
    form.setFieldsValue({
      name: kb.name,
      description: kb.description || '',
      system_prompt: kb.system_prompt || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: {
    name: string;
    description?: string;
    system_prompt?: string;
  }) => {
    try {
      if (isEditing && editingKB) {
        await dispatch(updateKB({ id: editingKB.id, data: values })).unwrap();
        message.success('知识库更新成功');
        dispatch(fetchKBList(page));
      } else {
        await dispatch(createKB(values)).unwrap();
        message.success('知识库创建成功');
        dispatch(fetchKBList(page));
      }
      setModalOpen(false);
      setEditingKB(null);
      form.resetFields();
    } catch (err: unknown) {
      message.error((err as { message?: string })?.message || '创建失败');
    }
  };

  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除知识库「${name}」吗？此操作不可撤销。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await dispatch(deleteKB(id));
        if (list.length === 1 && page > 1) {
          dispatch(setPage(page - 1));
        } else {
          dispatch(fetchKBList(page));
        }
        message.success('已删除');
      },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Typography.Title level={3} style={{ margin: '0 0 4px', fontWeight: 700 }}>
          我的知识库
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
          管理所有知识库，开始构建你的 AI 知识体系
        </Typography.Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Typography.Text type="secondary">
          {total > 0 ? `共 ${total} 个知识库` : ''}
        </Typography.Text>
        <Button
          className="btn-glow"
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
          style={{
            height: 44, borderRadius: 14, fontWeight: 600, fontSize: 15, paddingInline: 24,
            background: 'linear-gradient(135deg, #b8860b, #c9940e)',
            border: 'none', boxShadow: '0 4px 15px rgba(184,134,11,0.2)',
          }}
        >
          新建知识库
        </Button>
      </div>

      {list.length === 0 && !loading ? (
        <Empty description="暂无知识库，点击上方按钮创建" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 80 }} />
      ) : (
        <Row gutter={[24, 24]}>
          {list.map((kb, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={kb.id}>
              <Card
                className="kb-card kb-card-enter"
                hoverable
                style={{
                  animationDelay: `${i * 0.08}s`, borderRadius: 18, overflow: 'hidden',
                }}
                styles={{ body: { padding: '24px 22px 20px' } }}
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
                actions={[
                  <Button key="edit" type="text" icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(kb); }}
                    style={{ borderRadius: 10, color: '#b8860b' }}>编辑</Button>,
                  <Button key="del" type="text" danger icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleDelete(kb.id, kb.name); }}
                    style={{ borderRadius: 10 }}>删除</Button>,
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: 'linear-gradient(135deg, #fef7e8, #fdf0d5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    border: '2px solid rgba(184,134,11,0.12)',
                  }}>
                    <BookOutlined style={{ fontSize: 22, color: '#b8860b' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>{kb.name}</div>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }} ellipsis={{ rows: 2 }}>
                      {kb.description || '暂无描述'}
                    </Typography.Paragraph>
                    {kb.system_prompt && (
                      <span style={{ marginTop: 10, display: 'inline-block', fontSize: 11, color: '#b8860b',
                        background: '#fef7e8', padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                        border: '1px solid rgba(184,134,11,0.1)' }}>
                        AI 人设已配置
                      </span>
                    )}
                  </div>
                  <RightOutlined style={{ color: '#ccc', marginTop: 14, flexShrink: 0, fontSize: 12 }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {total > 0 && (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <Pagination
          current={page}
          total={total}
          pageSize={10}
          onChange={(p) => dispatch(setPage(p))}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 个知识库`}
        />
      </div>
      )}

      <Modal
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>{isEditing ? '编辑知识库' : '新建知识库'}</span>}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingKB(null); }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
            <Input placeholder="输入知识库名称" style={{ borderRadius: 10, height: 42 }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="简要描述知识库内容" style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="system_prompt" label="AI 人设提示词" help="定义 AI 助手的角色和回答风格">
            <TextArea rows={3} placeholder="例如：你是一个前端技术专家，擅长解答 React 和 TypeScript 相关问题..." style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalOpen(false)} style={{ marginRight: 12, borderRadius: 10 }}>取消</Button>
            <Button type="primary" htmlType="submit" style={{ borderRadius: 10, fontWeight: 500 }}>
              {isEditing ? '保存' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
