import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet } from '../cache/redis';

/**
 * 统计分析服务：热度排行 + 知识库活跃度 + 单库统计。
 * 查询结果缓存 3 分钟，减少聚合查询对 DB 的压力。
 */
export class AnalyticsService {
  /**
   * 全局概览：热门条目 TOP 10 + 知识库活跃度排行 + 基础数据。
   */
  async getOverview(userId: string) {
    const cacheKey = `analytics:overview:${userId}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    // 热门条目 TOP 10：按知识库归属聚合 chunk 命中次数
    const hotEntries = await prisma.$queryRaw<
      Array<{ entry_title: string; kb_name: string; total_hits: number }>
    >`
      SELECT ke.title AS entry_title, kb.name AS kb_name,
             SUM(kc.hit_count)::int AS total_hits
      FROM knowledge_chunk kc
      JOIN knowledge_entry ke ON ke.id = kc.entry_id
      JOIN knowledge_base kb ON kb.id = ke.kb_id
      WHERE kb.user_id = ${userId}::uuid
        AND ke.status = 'ENABLED'
        AND kc.hit_count > 0
      GROUP BY ke.id, ke.title, kb.name
      ORDER BY total_hits DESC
      LIMIT 10
    `;

    // 知识库活跃度：按知识库汇总热度，并附带条目数
    const kbActivity = await prisma.$queryRaw<
      Array<{ kb_id: string; kb_name: string; total_hits: number; entry_count: number }>
    >`
      SELECT kb.id AS kb_id, kb.name AS kb_name,
             COALESCE(SUM(kc.hit_count), 0)::int AS total_hits,
             COUNT(DISTINCT ke.id)::int AS entry_count
      FROM knowledge_base kb
      LEFT JOIN knowledge_entry ke ON ke.kb_id = kb.id
      LEFT JOIN knowledge_chunk kc ON kc.entry_id = ke.id
      WHERE kb.user_id = ${userId}::uuid
      GROUP BY kb.id, kb.name
      ORDER BY total_hits DESC
    `;

    // 基础统计
    const [kbCount, entryCount, sessionCount] = await Promise.all([
      prisma.knowledgeBase.count({ where: { userId } }),
      prisma.knowledgeEntry.count({
        where: { kb: { userId } },
      }),
      prisma.chatSession.count({ where: { userId } }),
    ]);

    const result = {
      hotEntries,
      kbActivity,
      summary: { kbCount, entryCount, sessionCount },
    };

    await cacheSet(cacheKey, result, 300);
    return result;
  }

  /**
   * 单库统计：该库下热门条目 + 热度分布。
   */
  async getKBStats(kbId: string, userId: string) {
    const cacheKey = `analytics:kb:${kbId}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    // 验证知识库归属
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId },
      select: { name: true },
    });
    if (!kb) return null;

    const hotEntries = await prisma.$queryRaw<
      Array<{ entry_title: string; total_hits: number; status: string }>
    >`
      SELECT ke.title AS entry_title, SUM(kc.hit_count)::int AS total_hits,
             ke.status
      FROM knowledge_chunk kc
      JOIN knowledge_entry ke ON ke.id = kc.entry_id
      WHERE ke.kb_id = ${kbId}::uuid AND kc.hit_count > 0
      GROUP BY ke.id, ke.title, ke.status
      ORDER BY total_hits DESC
      LIMIT 10
    `;

    const result = { kbName: kb.name, hotEntries };
    await cacheSet(cacheKey, result, 300);
    return result;
  }
}

export const analyticsService = new AnalyticsService();
