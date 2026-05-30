import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table, Button, Input, Select, Space, Tag, Typography, Tooltip, App, Tabs, Spin, Empty, Modal, Drawer,
} from 'antd';
import { PlusOutlined, UploadOutlined, MessageOutlined, ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReactECharts from 'echarts-for-react';
import type { AppDispatch, RootState } from '../store';
import {
  fetchEntries, deleteEntry, toggleEntryStatus,
  setSearch, setStatusFilter, setPage,
} from '../store/knowledgeEntrySlice';
import EntryEditor from '../components/knowledge/EntryEditor';
import FileUpload from '../components/knowledge/FileUpload';
import { analyticsApi, type KBStatsData } from '../api/analytics.api';
import { knowledgeApi } from '../api/knowledge.api';
import type { KnowledgeEntry } from 'shared';

export default function KnowledgeEntryList() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { list, total, page, search, statusFilter, loading } = useSelector((s: RootState) => s.knowledgeEntry);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [previewEntry, setPreviewEntry] = useState<KnowledgeEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<KnowledgeEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => { if (id) dispatch(fetchEntries({ kbId: id, page, search, status: statusFilter })); },
    [id, page, search, statusFilter, dispatch]);

  const prevStatusMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const hasPending = list.some((e) => e.processing_status === 'PENDING' || e.processing_status === 'PROCESSING');
    if (!hasPending || !id) return;
    const timer = setInterval(() => { dispatch(fetchEntries({ kbId: id, page, search, status: statusFilter })); }, 3000);
    return () => clearInterval(timer);
  }, [list, id, page, search, statusFilter, dispatch]);

  useEffect(() => {
    for (const entry of list) {
      const prev = prevStatusMap.current.get(entry.id);
      if (prev && (prev === 'PENDING' || prev === 'PROCESSING') && entry.processing_status === 'FAILED') {
        message.error('文档处理失败，请检查文件内容后重新上传');
      }
    }
    prevStatusMap.current = new Map(list.map((e) => [e.id, e.processing_status]));
  }, [list, message]);

  const handleDelete = (eid: string, title: string) => {
    modal.confirm({
      title: '确认删除', okText: '确认', cancelText: '取消',
      content: `确定要删除「${title}」吗？`,
      okButtonProps: { danger: true },
      onOk: async () => { await dispatch(deleteEntry({ kbId: id!, eid })); message.success('已删除'); },
    });
  };

  const handleOpenDetail = async (entry: KnowledgeEntry) => {
    try {
      const res = await knowledgeApi.getEntry(id!, entry.id);
      if (res.code === 0) {
        setDetailEntry(res.data);
        setDetailOpen(true);
      }
    } catch { /* ignore */ }
  };

  const handleToggleStatus = async (entry: KnowledgeEntry) => {
    const newStatus = entry.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    await dispatch(toggleEntryStatus({ kbId: id!, eid: entry.id, status: newStatus }));
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (t: string, record: KnowledgeEntry) => (
        <a style={{ fontWeight: 500 }} onClick={() => handleOpenDetail(record)}>{t}</a>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (t: string, record: KnowledgeEntry) => {
        const isImage = /\.(png|jpg|jpeg)$/i.test(record.source_file_name || '');
        if (isImage) return <Tag color="orange">图片</Tag>;
        return <Tag color={t === 'MANUAL' ? 'blue' : 'purple'}>{t === 'MANUAL' ? '手动' : '文件'}</Tag>;
      },
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string, record: KnowledgeEntry) => (
        <Tag color={s === 'ENABLED' ? 'success' : 'error'} style={{ cursor: 'pointer' }} onClick={() => handleToggleStatus(record)}>
          {s === 'ENABLED' ? '可用' : '不可用'}
        </Tag>),
    },
    { title: '处理状态', dataIndex: 'processing_status', key: 'processing_status', width: 100,
      render: (ps: string, record: KnowledgeEntry) => {
        const map: Record<string, { color: string; text: string }> = {
          PENDING: { color: 'default', text: '待处理' }, PROCESSING: { color: 'processing', text: '处理中' },
          COMPLETED: { color: 'success', text: '已完成' }, FAILED: { color: 'error', text: '失败' },
        };
        const info = map[ps] || { color: 'default', text: ps };
        const tag = <Tag color={info.color}>{info.text}</Tag>;
        if (ps === 'FAILED' && record.processing_message) {
          return <Tooltip title={record.processing_message} color="#c0392b">{tag}</Tooltip>;
        }
        return tag;
      },
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170,
      render: (d: string) => new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
    { title: '操作', key: 'actions', width: 220, align: 'center' as const,
      render: (_: unknown, record: KnowledgeEntry) => {
        const ext = (record.source_file_name || '').split('.').pop()?.toLowerCase();
        const noExt = !ext; // 手动录入，无后缀
        const canPreview = noExt || ext === 'md' || ext === 'txt' || ext === 'png' || ext === 'jpg' || ext === 'jpeg';
        const noPreview = ext === 'csv' || ext === 'xlsx' || ext === 'pdf' || ext === 'docx';
        return (
          <Space>
            {canPreview && (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewEntry(record)}>预览</Button>
            )}
            {noPreview && (
              <Tooltip title="暂不支持预览此类型文件">
                <Button type="link" size="small" icon={<EyeOutlined />} disabled>预览</Button>
              </Tooltip>
            )}
            <Button type="link" size="small" onClick={() => { setEditingEntry(record); setEditorOpen(true); }}>编辑</Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(record.id, record.title)}>删除</Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ fontSize: 17 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>知识条目管理</Typography.Title>
        </div>
        <Button className="btn-glow" type="primary" icon={<MessageOutlined />}
          onClick={() => navigate(`/knowledge-bases/${id}/chat`)}
          style={{ borderRadius: 12, fontWeight: 600, fontSize: 14, background: 'linear-gradient(135deg, #b8860b, #c9940e)', border: 'none', boxShadow: '0 4px 15px rgba(184,134,11,0.2)' }}>
          对话问答
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'list', label: '条目列表',
          children: (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: '#fff', padding: '14px 18px', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(184,134,11,0.06)' }}>
                <Space>
                  <Input.Search placeholder="搜索条目..." allowClear style={{ width: 280 }} value={search} onChange={(e) => dispatch(setSearch(e.target.value))} />
                  <Select placeholder="状态筛选" allowClear style={{ width: 130 }} value={statusFilter || undefined} onChange={(v) => dispatch(setStatusFilter(v || ''))} options={[{ value: 'ENABLED', label: '可用' }, { value: 'DISABLED', label: '不可用' }]} />
                </Space>
                <Space>
                  <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)} style={{ borderRadius: 10 }}>上传文档</Button>
                  <Button className="btn-glow" type="primary" icon={<PlusOutlined />} onClick={() => { setEditingEntry(null); setEditorOpen(true); }} style={{ borderRadius: 10, fontWeight: 500, background: 'linear-gradient(135deg, #b8860b, #c9940e)', border: 'none', boxShadow: '0 4px 15px rgba(184,134,11,0.2)' }}>手动录入</Button>
                </Space>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '0 4px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.03)' }}>
                <Table dataSource={list} columns={columns} rowKey="id" loading={loading}
                  pagination={{ total, current: page, pageSize: 10, onChange: (p) => dispatch(setPage(p)), showTotal: (t) => `共 ${t} 条` }} />
              </div>
            </>
          ),
        },
        { key: 'stats', label: '数据统计', children: activeTab === 'stats' ? <KBStatsPanel kbId={id!} /> : null },
      ]} />

      <EntryEditor open={editorOpen} kbId={id!} entry={editingEntry}
        onClose={() => { setEditorOpen(false); setEditingEntry(null); }}
        onSaved={() => { setEditorOpen(false); setEditingEntry(null); dispatch(fetchEntries({ kbId: id!, page: 1, search, status: statusFilter })); }} />
      <FileUpload open={uploadOpen} kbId={id!} onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); dispatch(fetchEntries({ kbId: id!, page: 1, search, status: statusFilter })); }} />

      <EntryPreview entry={previewEntry} onClose={() => setPreviewEntry(null)} />

      <Drawer
        title={
          <Typography.Text style={{ fontWeight: 600, fontSize: 16 }} ellipsis={{ tooltip: detailEntry?.title }}>
            {detailEntry?.title || '知识详情'}
          </Typography.Text>
        }
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailEntry(null); }}
        width={720}
        styles={{ body: { padding: '20px 28px', background: '#fefdf9' } }}
      >
        {detailEntry && <DetailContent entry={detailEntry} />}
      </Drawer>
    </div>
  );
}

/** 从内容中提取 OSS 图片 URL */
function extractImageUrl(content: string): string | null {
  const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  return match ? match[1] : null;
}

function isImageEntry(entry: KnowledgeEntry): boolean {
  return /\.(png|jpg|jpeg)$/i.test(entry.source_file_name || '');
}

/** 条目预览弹窗：图片直接展示，Markdown/文本渲染展示 */
function EntryPreview({ entry, onClose }: { entry: KnowledgeEntry | null; onClose: () => void }) {
  if (!entry) return null;

  const imageEntry = isImageEntry(entry);
  const imageUrl = imageEntry ? extractImageUrl(entry.content) : null;

  return (
    <Modal
      title={entry.title}
      open={!!entry}
      onCancel={onClose}
      footer={null}
      width={imageEntry ? 680 : 800}
    >
      {imageEntry && imageUrl ? (
        <div style={{ textAlign: 'center' }}>
          <img src={imageUrl} alt={entry.title} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12 }} />
        </div>
      ) : (
        <div className="markdown-body" style={{ maxHeight: '70vh', overflow: 'auto', padding: '8px 4px' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {entry.content}
          </ReactMarkdown>
        </div>
      )}
    </Modal>
  );
}

/** 条目详情抽屉内容 */
function DetailContent({ entry }: { entry: KnowledgeEntry }) {
  const ext = (entry.source_file_name || '').split('.').pop()?.toLowerCase();
  const noExt = !ext;
  const canShow = noExt || ext === 'md' || ext === 'txt' || ext === 'png' || ext === 'jpg' || ext === 'jpeg';
  const imageEntry = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
  const imageUrl = imageEntry ? extractImageUrl(entry.content) : null;

  return (
    <div>
      {/* 元信息行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Space>
          {imageEntry ? (
            <Tag color="orange">图片</Tag>
          ) : (
            <Tag color={entry.type === 'MANUAL' ? 'blue' : 'purple'}>
              {entry.type === 'MANUAL' ? '手动' : '文件'}
            </Tag>
          )}
          <Tag color={entry.status === 'ENABLED' ? 'success' : 'error'}>
            {entry.status === 'ENABLED' ? '可用' : '不可用'}
          </Tag>
          {entry.source_file_name && !imageEntry && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              来源: {entry.source_file_name}
            </Typography.Text>
          )}
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(entry.created_at).toLocaleString('zh-CN')}
        </Typography.Text>
      </div>

      {/* 分隔线 */}
      <div style={{ borderTop: '1px solid #e8e0d0', paddingTop: 20 }} />

      {/* 内容区 */}
      {canShow ? (
        imageEntry && imageUrl ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <img src={imageUrl} alt={entry.title}
              style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
          </div>
        ) : (
          <div
            className="markdown-body"
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px 24px',
              border: '1px solid #f0ebe0',
              lineHeight: 1.8,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {entry.content}
            </ReactMarkdown>
          </div>
        )
      ) : (
        <Empty
          description={
            <span style={{ color: '#999', fontSize: 14 }}>
              该类型文件暂不支持内容预览
            </span>
          }
          style={{ marginTop: 40 }}
        />
      )}
    </div>
  );
}

/** 单知识库统计面板 */
function KBStatsPanel({ kbId }: { kbId: string }) {
  const [data, setData] = useState<KBStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = () => {
      analyticsApi.getKBStats(kbId).then((res) => {
        if (res.code === 0) setData(res.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    };
    fetch();
    const timer = setInterval(fetch, 300000);
    return () => clearInterval(timer);
  }, [kbId]);

  if (loading) return <Spin style={{ display: 'block', marginTop: 60 }} />;
  if (!data || data.hotEntries.length === 0) return <Empty style={{ marginTop: 60 }} description="暂无检索数据，去对话问问 AI 吧" />;

  const colors = ['#b8860b', '#d4a017', '#c9940e', '#e6a817', '#f0c040', '#f5d060', '#fae080', '#e0c870', '#c08020', '#a07010'];

  const barOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.97)', borderColor: '#e8e0d0', borderWidth: 1,
      textStyle: { color: '#333', fontSize: 13 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `<strong>${p.name}</strong><br/>检索命中：<span style="color:#b8860b;font-weight:600">${p.value} 次</span>`;
      },
    },
    grid: { left: 4, right: 50, top: 10, bottom: 0, containLabel: true },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f0ebe0' } }, axisLabel: { color: '#999' } },
    yAxis: { type: 'category', inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#555', fontWeight: 500, width: 130, overflow: 'truncate' }, data: data.hotEntries.map((e) => e.entry_title) },
    series: [{
      name: '检索命中次数',
      type: 'bar',
      data: data.hotEntries.map((e, i) => ({
        value: e.total_hits,
        itemStyle: { borderRadius: [0, 8, 8, 0], color: colors[i % colors.length] },
      })),
      barWidth: 22,
      label: { show: true, position: 'right', fontWeight: 600, fontSize: 13 },
      emphasis: { label: { fontSize: 15 } },
    }],
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      <Typography.Title level={5} style={{ marginBottom: 8 }}>{data.kbName} · 热门条目</Typography.Title>
      <Typography.Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>条目检索命中次数</Typography.Text>
      <ReactECharts option={barOption} style={{ height: 340 }} />
    </div>
  );
}
