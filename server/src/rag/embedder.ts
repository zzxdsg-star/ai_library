import { getEmbedding, getEmbeddings } from '../ai/bailian';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 单条文本向量化（委托 LangChain OpenAIEmbeddings）。
 */
export async function embedText(text: string): Promise<number[]> {
  return getEmbedding(text);
}

/**
 * 批量分块向量化并入库。
 *
 * LangChain embedDocuments 内部并行调用百炼 API 提升效率。
 * 使用 Prisma 原生 SQL INSERT 以支持 pgvector vector 类型。
 * 事务包裹确保同一 entry 的所有 chunk 原子写入。
 *
 * 选型说明（text-embedding-v2）：
 * 阿里云百炼第二代 Embedding 模型，1536 维输出。
 * v2 在中文语义理解（C-MTEB 基准）上显著优于 v1，
 * 1536 维在召回精度和存储成本间取平衡。
 */
export async function embedAndStoreChunks(
  entryId: string,
  chunks: Array<{ index: number; content: string }>,
): Promise<void> {
  const texts = chunks.map((c) => c.content);
  const embeddings = await getEmbeddings(texts);

  await prisma.$transaction(
    chunks.map((chunk, i) =>
      prisma.$executeRaw`
        INSERT INTO knowledge_chunk (id, entry_id, chunk_index, content, embedding, hit_count, created_at)
        VALUES (gen_random_uuid(), ${entryId}::uuid, ${chunk.index}, ${chunk.content},
                ${embeddings[i]}::vector, 0, NOW())
      `,
    ),
  );
}
