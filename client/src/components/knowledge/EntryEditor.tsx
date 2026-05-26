import { Modal, Form, Input, Button, App } from 'antd';
import { useDispatch } from 'react-redux';
import { createEntry } from '../../store/knowledgeEntrySlice';
import type { AppDispatch } from '../../store';

const { TextArea } = Input;

interface Props {
  open: boolean;
  kbId: string;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * 手动录入知识条目 Modal。
 * 标题 + Markdown 内容区域。
 */
export default function EntryEditor({ open, kbId, onClose, onCreated }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const handleSubmit = async (values: { title: string; content: string }) => {
    try {
      await dispatch(createEntry({ kbId, data: values })).unwrap();
      message.success('创建成功');
      form.resetFields();
      onCreated();
    } catch (err: any) {
      message.error(err?.message || '创建失败');
    }
  };

  return (
    <Modal title="新建知识条目" open={open} onCancel={onClose} footer={null} width={700}>
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
            创建
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
