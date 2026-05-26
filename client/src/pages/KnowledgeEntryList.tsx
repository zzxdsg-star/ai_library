import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Input, Select, Space, Tag, Modal, Typography, App } from 'antd';
import { PlusOutlined, UploadOutlined, MessageOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { AppDispatch, RootState } from '../store';
import {
  fetchEntries,
  deleteEntry,
  toggleEntryStatus,
  setSearch,
  setStatusFilter,
  setPage,
} from '../store/knowledgeEntrySlice';
import EntryEditor from '../components/knowledge/EntryEditor';
import FileUpload from '../components/knowledge/FileUpload';
import type { KnowledgeEntry } from 'shared';

/**
 * 知识条目管理页：表格展示 + 搜索筛选 + 手动录入 + 文档上传。
 */
export default function KnowledgeEntryList() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { list, total, page, search, statusFilter, loading } = useSelector(
    (s: RootState) => s.knowledgeEntry,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(
        fetchEntries({ kbId: id, page, search, status: statusFilter }),
      );
    }
  }, [id, page, search, statusFilter, dispatch]);

  const handleDelete = (eid: string, title: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除「${title}」吗？`,
      onOk: async () => {
        await dispatch(deleteEntry({ kbId: id!, eid }));
        message.success('已删除');
      },
    });
  };

  const handleToggleStatus = async (entry: KnowledgeEntry) => {
    const newStatus = entry.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    await dispatch(
      toggleEntryStatus({ kbId: id!, eid: entry.id, status: newStatus }),
    );
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: string) => (t === 'MANUAL' ? '手动' : '文件'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string, record: KnowledgeEntry) => (
        <Tag
          color={s === 'ENABLED' ? 'green' : 'red'}
          style={{ cursor: 'pointer' }}
          onClick={() => handleToggleStatus(record)}
        >
          {s === 'ENABLED' ? '可用' : '不可用'}
        </Tag>
      ),
    },
    {
      title: '处理状态',
      dataIndex: 'processing_status',
      key: 'processing_status',
      width: 100,
      render: (ps: string) => {
        const map: Record<string, { color: string; text: string }> = {
          PENDING: { color: 'default', text: '待处理' },
          PROCESSING: { color: 'processing', text: '处理中' },
          COMPLETED: { color: 'green', text: '已完成' },
          FAILED: { color: 'red', text: '失败' },
        };
        const info = map[ps] || { color: 'default', text: ps };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: KnowledgeEntry) => (
        <Space>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record.id, record.title)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          知识条目管理
        </Typography.Title>
        <Button
          type="primary"
          icon={<MessageOutlined />}
          onClick={() => navigate(`/knowledge-bases/${id}/chat`)}
        >
          对话问答
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Space>
          <Input.Search
            placeholder="搜索条目..."
            allowClear
            style={{ width: 300 }}
            value={search}
            onChange={(e) => dispatch(setSearch(e.target.value))}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            value={statusFilter || undefined}
            onChange={(v) => dispatch(setStatusFilter(v || ''))}
            options={[
              { value: 'ENABLED', label: '可用' },
              { value: 'DISABLED', label: '不可用' },
            ]}
          />
        </Space>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            上传文档
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEditorOpen(true)}
          >
            手动录入
          </Button>
        </Space>
      </div>

      <Table
        dataSource={list}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          total,
          current: page,
          pageSize: 10,
          onChange: (p) => dispatch(setPage(p)),
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      <EntryEditor
        open={editorOpen}
        kbId={id!}
        onClose={() => setEditorOpen(false)}
        onCreated={() => {
          setEditorOpen(false);
          dispatch(
            fetchEntries({
              kbId: id!,
              page: 1,
              search,
              status: statusFilter,
            }),
          );
        }}
      />
      <FileUpload
        open={uploadOpen}
        kbId={id!}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          dispatch(
            fetchEntries({
              kbId: id!,
              page: 1,
              search,
              status: statusFilter,
            }),
          );
        }}
      />
    </div>
  );
}
