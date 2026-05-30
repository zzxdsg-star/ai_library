import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, App } from 'antd';
import { useDispatch } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

  // 编辑模式下提取文件后缀（不可修改）
  const sourceExt = entry?.source_file_name?.split('.').pop()?.toLowerCase();
  const hasExtension = isEditing && !!sourceExt;

  const [previewContent, setPreviewContent] = useState('');

  useEffect(() => {
    if (open) {
      if (entry) {
        const baseName = hasExtension
          ? entry.title.slice(0, -(sourceExt.length + 1)) // 去掉 .ext
          : entry.title;
        form.setFieldsValue({ title: baseName });
      } else {
        form.resetFields();
      }
      setPreviewContent('');
    }
  }, [open, entry, form, hasExtension, sourceExt]);

  const handleSubmit = async (values: { title: string; content?: string }) => {
    try {
      const title = hasExtension ? `${values.title}.${sourceExt}` : values.title;
      if (isEditing && entry) {
        await dispatch(updateEntry({ kbId, eid: entry.id, data: { title } })).unwrap();
        message.success('更新成功');
      } else {
        await dispatch(createEntry({ kbId, data: { title, content: values.content || '' } })).unwrap();
        message.success('创建成功');
      }
      form.resetFields();
      setPreviewContent('');
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
      width={isEditing ? 500 : 960}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} validateTrigger="onBlur">
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input
            placeholder="知识标题"
            suffix={hasExtension ? <span style={{ color: '#999' }}>.{sourceExt}</span> : undefined}
          />
        </Form.Item>

        {!isEditing && (
          <Form.Item
            name="content"
            label="内容 (Markdown)"
            rules={[{ required: true }]}
            help="支持 Markdown 语法，右侧实时预览渲染效果"
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <TextArea
                rows={14}
                placeholder="使用 Markdown 格式编写知识内容..."
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                onChange={(e) => setPreviewContent(e.target.value)}
              />
              <div
                className="markdown-body"
                style={{
                  flex: 1,
                  border: '1px solid #e8e0d0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  overflow: 'auto',
                  maxHeight: 316,
                  background: '#fefdf9',
                }}
              >
                {previewContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewContent}
                  </ReactMarkdown>
                ) : (
                  <span style={{ color: '#ccc' }}>预览区域，输入内容后实时显示</span>
                )}
              </div>
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit">
            {isEditing ? '保存' : '创建'}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
