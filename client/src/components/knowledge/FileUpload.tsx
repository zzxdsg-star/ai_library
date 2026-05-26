import { Modal, Upload, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../../api/knowledge.api';

const { Dragger } = Upload;

interface Props {
  open: boolean;
  kbId: string;
  onClose: () => void;
  onUploaded: () => void;
}

/**
 * 文档上传 Modal，支持拖拽上传。
 * 支持 PDF、Word、Markdown、纯文本格式。
 */
export default function FileUpload({ open, kbId, onClose, onUploaded }: Props) {
  const { message } = App.useApp();

  const handleUpload = async (file: File) => {
    try {
      const res = await knowledgeApi.uploadFile(kbId, file);
      if (res.code === 0) {
        message.success('上传成功，正在后台处理...');
        onUploaded();
      } else {
        message.error(res.message || '上传失败');
      }
    } catch {
      message.error('上传失败');
    }
  };

  return (
    <Modal title="上传文档" open={open} onCancel={onClose} footer={null}>
      <Dragger
        accept=".pdf,.docx,.md,.txt"
        multiple={false}
        beforeUpload={(file) => {
          handleUpload(file);
          return false; // 阻止默认上传行为
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 PDF、Word、Markdown、TXT 格式
        </p>
      </Dragger>
    </Modal>
  );
}
