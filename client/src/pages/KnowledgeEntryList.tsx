import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  Tooltip,
  App,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  MessageOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
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
 * 知识条目管理页 — 搜索栏 + 状态筛选 + 表格 + 上传/录入操作。
 */
export default function KnowledgeEntryList() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
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

  // 记录上一次的条目状态，用于检测状态变化
  const prevStatusMap = useRef<Map<string, string>>(new Map());

  // 有待处理/处理中的条目时，每 3 秒自动刷新状态
  useEffect(() => {
    const hasPending = list.some(
      (e) =>
        e.processing_status === 'PENDING' ||
        e.processing_status === 'PROCESSING',
    );
    if (!hasPending || !id) return;

    const timer = setInterval(() => {
      dispatch(
        fetchEntries({ kbId: id, page, search, status: statusFilter }),
      );
    }, 3000);

    return () => clearInterval(timer);
  }, [list, id, page, search, statusFilter, dispatch]);

  // 检测条目状态变化：处理中 → 失败 → 弹窗提示
  useEffect(() => {
    for (const entry of list) {
      const prev = prevStatusMap.current.get(entry.id);
      if (
        prev &&
        (prev === 'PENDING' || prev === 'PROCESSING') &&
        entry.processing_status === 'FAILED'
      ) {
        message.error('文档处理失败，请检查文件内容后重新上传');
      }
    }
    // 更新状态快照
    prevStatusMap.current = new Map(
      list.map((e) => [e.id, e.processing_status]),
    );
  }, [list, message]);

  const handleDelete = (eid: string, title: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除「${title}」吗？`,
      okText: '确认',
      cancelText: '取消', 
      okButtonProps: { danger: true },
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
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (t: string) => (
        <span style={{ fontWeight: 500 }}>{t}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: string) => (
        <Tag color={t === 'MANUAL' ? 'blue' : 'purple'}>
          {t === 'MANUAL' ? '手动' : '文件'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string, record: KnowledgeEntry) => (
        <Tag
          color={s === 'ENABLED' ? 'success' : 'error'}
          style={{ cursor: 'pointer', borderRadius: 6 }}
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
      render: (ps: string, record: KnowledgeEntry) => {
        const map: Record<
          string,
          { color: string; text: string }
        > = {
          PENDING: { color: 'default', text: '待处理' },
          PROCESSING: { color: 'processing', text: '处理中' },
          COMPLETED: { color: 'success', text: '已完成' },
          FAILED: { color: 'error', text: '失败' },
        };
        const info = map[ps] || { color: 'default', text: ps };
        const tag = <Tag color={info.color}>{info.text}</Tag>;
        if (ps === 'FAILED' && record.processing_message) {
          return (
            <Tooltip title={record.processing_message} color="#c0392b">
              {tag}
            </Tooltip>
          );
        }
        return tag;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: (d: string) =>
        new Date(d).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: KnowledgeEntry) => (
        <Button
          type="link"
          size="small"
          danger
          onClick={() => handleDelete(record.id, record.title)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 顶栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            知识条目管理
          </Typography.Title>
        </div>
        <Button
          type="primary"
          icon={<MessageOutlined />}
          onClick={() => navigate(`/knowledge-bases/${id}/chat`)}
          style={{ borderRadius: 8, fontWeight: 500 }}
        >
          对话问答
        </Button>
      </div>

      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          background: '#fff',
          padding: '14px 18px',
          borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Space>
          <Input.Search
            placeholder="搜索条目..."
            allowClear
            style={{ width: 280 }}
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
          <Button
            icon={<UploadOutlined />}
            onClick={() => setUploadOpen(true)}
          >
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

      {/* 表格 */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: '0 4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
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
      </div>

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
