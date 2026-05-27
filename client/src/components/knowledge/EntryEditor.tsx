import { useEffect } from 'react';
import { Modal, Form, Input, Button, App } from 'antd';
import { useDispatch } from 'react-redux';
import { createEntry, updateEntry } from '../../store/knowledgeEntrySlice';
import type { AppDispatch } from '../../store';
import type { KnowledgeEntry } from 'shared';

const { TextArea } = Input;

interface Props {
  open: boolean;
  kbId: string;
  entry?: KnowledgeEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EntryEditor({ open, kbId, entry, onClose, onSaved }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const isEditing = !!entry;

  useEffect(() => {
    if (open) {
      if (entry) {
        form.setFieldsValue({ title: entry.title, content: entry.content });
      } else {
        form.resetFields();
      }
    }
  }, [open, entry, form]);

  const handleSubmit = async (values: { title: string; content: string }) => {
    try {
      if (isEditing && entry) {
        await dispatch(updateEntry({ kbId, eid: entry.id, data: values })).unwrap();
        message.success('更新成功');
      } else {
        await dispatch(createEntry({ kbId, data: values })).unwrap();
        message.success('创建成功');
      }
      form.resetFields();
      onSaved();
    } catch (err: unknown) {
      message.error((err as { message?: string })?.message || '操作失败');
    }
  };

  return (
    <Modal
      title={isEditing ? '编辑知识条目' : '新建知识条目'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input placeholder="知识标题" />
        </Form.Item>
        <Form.Item
          name="content"
          label="内容 (Markdown)"
          rules={[{ required: true }]}
          help="支持 Markdown 格式编写知识内容"
        >
          <TextArea rows={12} placeholder="使用 Markdown 格式编写知识内容..." />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            {isEditing ? '保存' : '创建'}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
