import { useState } from 'react';
import { Modal, Upload, App } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../../api/knowledge.api';

const { Dragger } = Upload;

interface Props {
  open: boolean;
  kbId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function FileUpload({ open, kbId, onClose, onUploaded }: Props) {
  const { message } = App.useApp();
  const [uploadKey, setUploadKey] = useState(0);

  const handleOpen = () => setUploadKey((k) => k + 1);

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
    <Modal
      title={<span style={{ fontSize: 17, fontWeight: 600 }}>上传文档</span>}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleOpen}
      footer={null}
      width={500}
    >
      <Dragger
        key={uploadKey}
        accept=".pdf,.docx,.md,.txt"
        multiple={false}
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
        style={{ borderRadius: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <CloudUploadOutlined style={{ color: '#b8860b' }} />
        </p>
        <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: 15 }}>
          点击或拖拽文件到此区域
        </p>
        <p className="ant-upload-hint" style={{ color: '#999' }}>
          支持 PDF、Word、Markdown、TXT，最大 20MB
        </p>
      </Dragger>
    </Modal>
  );
}
