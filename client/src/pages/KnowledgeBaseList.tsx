import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Button, Modal, Form, Input, Row, Col, Typography, Empty, App } from 'antd';
import { PlusOutlined, BookOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '../store';
import { fetchKBList, createKB, deleteKB } from '../store/knowledgeBaseSlice';

const { TextArea } = Input;

/**
 * 首页：知识库列表，以卡片网格展示。
 */
export default function KnowledgeBaseList() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message } = App.useApp();
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
      message.success('创建成功');
      setModalOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err?.message || '创建失败');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除知识库「${name}」吗？此操作不可撤销。`,
      onOk: async () => {
        await dispatch(deleteKB(id));
        message.success('已删除');
      },
    });
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的知识库
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          新建知识库
        </Button>
      </div>

      {list.length === 0 && !loading ? (
        <Empty description="暂无知识库，点击上方按钮创建" />
      ) : (
        <Row gutter={[16, 16]}>
          {list.map((kb) => (
            <Col xs={24} sm={12} md={8} lg={6} key={kb.id}>
              <Card
                hoverable
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
                actions={[
                  <DeleteOutlined
                    key="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(kb.id, kb.name);
                    }}
                  />,
                ]}
              >
                <Card.Meta
                  avatar={
                    <BookOutlined
                      style={{ fontSize: 24, color: '#1677ff' }}
                    />
                  }
                  title={kb.name}
                  description={kb.description || '暂无描述'}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建知识库"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
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
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
