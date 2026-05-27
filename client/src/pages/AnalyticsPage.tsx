import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin, Empty, Table } from 'antd';
import {
  DatabaseOutlined,
  FileTextOutlined,
  MessageOutlined,
  FireOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { analyticsApi, type OverviewData } from '../api/analytics.api';

const cardStyle = { borderRadius: 16 };

export default function AnalyticsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    analyticsApi.getOverview().then((res) => {
      if (res.code === 0) setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 300000); // 每 5 分钟自动刷新
    return () => clearInterval(timer);
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 120 }} />;
  if (!data) return <Empty style={{ marginTop: 120 }} description="暂无统计数据" />;

  const hasData = data.hotEntries.length > 0 || data.kbActivity.some((k) => k.total_hits > 0);

  // 柱状图：热门条目 TOP 10
  const barOption = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#e8e0d0',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 13 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `<strong>${p.name}</strong><br/>检索命中：<span style="color:#b8860b;font-weight:600">${p.value} 次</span>`;
      },
    },
    grid: { left: 4, right: 50, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0ebe0' } },
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'category' as const,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#555', fontWeight: 500, width: 130, overflow: 'truncate' },
      data: data.hotEntries.map((e) => e.entry_title),
    },
    series: [{
      name: '检索命中次数',
      type: 'bar',
      data: data.hotEntries.map((e) => ({
        value: e.total_hits,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#fdf0d5' },
              { offset: 1, color: '#b8860b' },
            ],
          },
        },
      })),
      barWidth: 22,
      label: { show: true, position: 'right' as const, color: '#b8860b', fontWeight: 600, fontSize: 13 },
      emphasis: {
        itemStyle: { color: '#d4a017' },
        label: { fontSize: 15 },
      },
    }],
  };

  // 环形图：知识库活跃度分布
  const pieOption = {
    tooltip: {
      trigger: 'item' as const,
      confine: true,
      backgroundColor: 'rgba(30,32,36,0.92)',
      borderColor: 'rgba(184,134,11,0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 13 },
      formatter: (params: any) => {
        return `<strong>${params.name}</strong><br/>检索命中：<span style="color:#ffd700;font-weight:600">${params.value} 次</span>（${params.percent}%）`;
      },
    },
    series: [{
      name: '检索命中',
      type: 'pie',
      radius: ['50%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 15, fontWeight: 'bold' },
        scaleSize: 12,
        focus: 'self' as const,
      },
      data: data.kbActivity
        .filter((k) => k.total_hits > 0)
        .map((k) => ({
          value: k.total_hits,
          name: k.kb_name,
        })),
      color: ['#b8860b', '#d4a017', '#c9940e', '#e6a817', '#f0c040', '#f5d060', '#fae080', '#e0c870', '#c08020', '#a07010'],
    }],
  };

  // KB 活跃度表格列
  const kbColumns = [
    { title: '知识库', dataIndex: 'kb_name', key: 'kb_name', render: (t: string) => <strong>{t}</strong> },
    { title: '条目数', dataIndex: 'entry_count', key: 'entry_count', align: 'center' as const },
    { title: '检索命中', dataIndex: 'total_hits', key: 'total_hits', align: 'center' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#b8860b' : '#999', fontWeight: v > 0 ? 600 : 400 }}>{v}</span>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <Typography.Title level={3} style={{ margin: '0 0 4px', fontWeight: 700 }}>
          <FireOutlined style={{ color: '#b8860b', marginRight: 10 }} />
          数据统计
        </Typography.Title>
        <Typography.Text type="secondary">知识检索热度概览，数据每 5 分钟更新</Typography.Text>
      </div>

      {/* 概览卡片 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic title="知识库" value={data.summary.kbCount}
              prefix={<DatabaseOutlined style={{ color: '#b8860b' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic title="知识条目" value={data.summary.entryCount}
              prefix={<FileTextOutlined style={{ color: '#d4a017' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic title="对话次数" value={data.summary.sessionCount}
              prefix={<MessageOutlined style={{ color: '#4a9e6e' }} />} />
          </Card>
        </Col>
      </Row>

      {!hasData ? (
        <Empty description="暂无检索数据，去知识库问问 AI 吧" style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* 热门条目 + 知识库活跃度 并排 */}
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <Card
                title={<span><TrophyOutlined style={{ color: '#b8860b', marginRight: 8 }} />热门知识 TOP 10</span>}
                style={cardStyle}
                styles={{ body: { padding: '16px 8px' } }}
              >
                <ReactECharts option={barOption} style={{ height: 380 }} />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title="知识库活跃度"
                style={cardStyle}
                styles={{ body: { padding: '16px 8px' } }}
              >
                <ReactECharts option={pieOption} style={{ height: 260 }} />
                <Table
                  dataSource={data.kbActivity}
                  columns={kbColumns}
                  rowKey="kb_id"
                  size="small"
                  pagination={false}
                  style={{ marginTop: 20 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
