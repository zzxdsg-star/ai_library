import { prisma } from '../lib/prisma';
import { embedText } from './embedder';

/**
 * 单条检索结果。
 */
export interface SearchResult {
  chunkId: string;
  entryId: string;
  entryTitle: string;
  content: string;
  score: number;
}

/**
 * 混合检索：向量语义搜索 + BM25 关键词搜索 → RRF 融合排序。
 *
 * 三步流程：
 * 1. 向量检索 (cosine, top_k=10) — 语义相似度初筛
 * 2. BM25 关键词检索 (top_k=5)  — 精确术语匹配补召
 * 3. RRF 融合排序 (k=60)         — 合并两个排序列表，取最终 top_k=5
 *
 * 检索后对被命中的 chunk 执行 hit_count+1，用于后续热度统计。
 *
 * 选型说明：
 * - 向量 top_k=10：初筛保留足够候选，RRF 融合时可剔除低质量结果
 * - BM25 top_k=5：关键词精确匹配作为语义搜索的互补信号
 * - RRF k=60：经典默认值（Reciprocal Rank Fusion 论文），
 *   平滑处理不同检索源的分数分布差异
 * - 最终 top_k=5：控制在 LLM 上下文窗口内的合理数量，
 *   避免 prompt 过长导致生成质量下降和 token 成本增加
 */
export async function hybridSearch(
  query: string,
  kbId: string,
  options?: {
    vectorTopK?: number;
    bm25TopK?: number;
    finalTopK?: number;
    rrfK?: number;
  },
): Promise<SearchResult[]> {
  const vectorTopK = options?.vectorTopK ?? 10;
  const bm25TopK = options?.bm25TopK ?? 5;
  const finalTopK = options?.finalTopK ?? 5;
  const rrfK = options?.rrfK ?? 60;

  // 1. 向量语义检索
  const queryEmbedding = await embedText(query);
  const vectorResults = await prisma.$queryRaw<
    Array<{
      id: string;
      entry_id: string;
      content: string;
      entry_title: string;
      similarity: number;
    }>
  >`
    SELECT kc.id, kc.entry_id, kc.content, ke.title AS entry_title,
           1 - (kc.embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM knowledge_chunk kc
    JOIN knowledge_entry ke ON ke.id = kc.entry_id
    WHERE ke.kb_id = ${kbId}::uuid
      AND ke.status = 'ENABLED'
    ORDER BY kc.embedding <=> ${queryEmbedding}::vector
    LIMIT ${vectorTopK}
  `;

  // 2. BM25 关键词检索（利用 PostgreSQL 全文搜索）
  const bm25Results = await prisma.$queryRaw<
    Array<{
      id: string;
      entry_id: string;
      content: string;
      entry_title: string;
      rank: number;
    }>
  >`
    SELECT kc.id, kc.entry_id, kc.content, ke.title AS entry_title,
           ts_rank_cd(
             to_tsvector('simple', kc.content),
             websearch_to_tsquery('simple', ${query})
           ) AS rank
    FROM knowledge_chunk kc
    JOIN knowledge_entry ke ON ke.id = kc.entry_id
    WHERE ke.kb_id = ${kbId}::uuid
      AND ke.status = 'ENABLED'
      AND to_tsvector('simple', kc.content) @@ websearch_to_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT ${bm25TopK}
  `;

  // 3. RRF 融合排序
  const scoreMap = new Map<
    string,
    { result: SearchResult; rrfScore: number }
  >();

  vectorResults.forEach((r, rank) => {
    const rrfScore = 1 / (rrfK + rank + 1);
    scoreMap.set(r.id, {
      result: {
        chunkId: r.id,
        entryId: r.entry_id,
        entryTitle: r.entry_title,
        content: r.content,
        score: r.similarity,
      },
      rrfScore,
    });
  });

  bm25Results.forEach((r, rank) => {
    const rrfScore = 1 / (rrfK + rank + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      // 同一 chunk 两个来源都命中，累加 RRF 分数
      existing.rrfScore += rrfScore;
    } else {
      scoreMap.set(r.id, {
        result: {
          chunkId: r.id,
          entryId: r.entry_id,
          entryTitle: r.entry_title,
          content: r.content,
          score: r.rank,
        },
        rrfScore,
      });
    }
  });

  const ranked = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, finalTopK);

  const results = ranked.map((r) => r.result);

  // 4. 命中计数 +1（用于热度统计）
  if (results.length > 0) {
    await prisma.knowledgeChunk.updateMany({
      where: { id: { in: results.map((r) => r.chunkId) } },
      data: { hitCount: { increment: 1 } },
    });
  }

  return results;
}
