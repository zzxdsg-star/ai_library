import { useState } from 'react';
import { Modal, Upload, App, Tabs } from 'antd';
import { CloudUploadOutlined, PictureOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../../api/knowledge.api';

const { Dragger } = Upload;

/** 从 fetch 错误中尝试读取服务端返回的消息 */
async function extractErrorMessage(err: unknown): Promise<string | null> {
  if (err instanceof Response) {
    try {
      const body = await err.json();
      return body?.message || null;
    } catch { /* ignore */ }
  }
  return null;
}

interface Props {
  open: boolean;
  kbId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function FileUpload({ open, kbId, onClose, onUploaded }: Props) {
  const { message } = App.useApp();
  const [uploadKey, setUploadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('doc');

  const resetUploader = () => setUploadKey((k) => k + 1);
  const handleOpen = () => resetUploader();

  const handleDocUpload = async (file: File) => {
    try {
      const res = await knowledgeApi.uploadFile(kbId, file);
      if (res.code === 0) {
        message.success('上传成功，正在后台处理...');
        onUploaded();
      } else {
        message.error(res.message || '上传失败');
        resetUploader();
      }
    } catch (err: unknown) {
      const msg = await extractErrorMessage(err);
      message.error(msg || '上传失败');
      resetUploader();
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const res = await knowledgeApi.uploadImages(kbId, [file]);
      if (res.code === 0) {
        message.success(`已上传 ${res.data?.entries?.length || 1} 张图片，正在后台处理...`);
        onUploaded();
      } else {
        message.error(res.message || '上传失败');
        resetUploader();
      }
    } catch (err: unknown) {
      const msg = await extractErrorMessage(err);
      message.error(msg || '上传失败');
      resetUploader();
    }
  };

  return (
    <Modal
      title={<span style={{ fontSize: 17, fontWeight: 600 }}>上传文件</span>}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleOpen}
      footer={null}
      width={520}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'doc',
            label: '文档',
            children: (
              <Dragger
                key={uploadKey + '-doc'}
                accept=".pdf,.docx,.md,.txt,.csv,.xlsx"
                multiple={false}
                beforeUpload={(file) => {
                  handleDocUpload(file);
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
                  支持 PDF、Word、Markdown、TXT、CSV、Excel，最大 20MB
                </p>
              </Dragger>
            ),
          },
          {
            key: 'image',
            label: '图片',
            children: (
              <Dragger
                key={uploadKey + '-img'}
                accept=".png,.jpg,.jpeg"
                multiple={true}
                beforeUpload={(file) => {
                  handleImageUpload(file);
                  return false;
                }}
                style={{ borderRadius: 16 }}
              >
                <p className="ant-upload-drag-icon">
                  <PictureOutlined style={{ color: '#b8860b' }} />
                </p>
                <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: 15 }}>
                  点击或拖拽图片到此区域
                </p>
                <p className="ant-upload-hint" style={{ color: '#999' }}>
                  支持 PNG、JPG，最大 5MB，可多选 · AI 自动识别图片内容
                </p>
              </Dragger>
            ),
          },
        ]}
      />
    </Modal>
  );
}
