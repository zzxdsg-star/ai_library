import { Card, Typography } from 'antd';
import type { Reference } from 'shared';

/**
 * 引用来源卡片，展示命中的知识条目摘要。
 */
export default function ReferenceCard({
  reference,
  index,
}: {
  reference: Reference;
  index: number;
}) {
  return (
    <Card size="small" style={{ marginBottom: 4 }}>
      <Typography.Text strong>
        [{index}] {reference.title}
      </Typography.Text>
      <Typography.Paragraph
        ellipsis={{ rows: 2 }}
        style={{ margin: 0, fontSize: 12 }}
        type="secondary"
      >
        {reference.content}
      </Typography.Paragraph>
    </Card>
  );
}
