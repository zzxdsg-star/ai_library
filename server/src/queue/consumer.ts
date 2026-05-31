import amqp from 'amqplib';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { chunkText } from '../rag/chunker';
import { embedAndStoreChunks } from '../rag/embedder';
import { cacheDelPattern } from '../cache/redis';

const QUEUE_NAME = 'document_processing';

/**
 * RabbitMQ Consumer：消费文档处理任务。
 *
 * 文本由 Producer 直接携带在消息中，不依赖 DB 读取，
 * 解决大文档解析时路由层已写入文本但 Consumer 读到空内容的问题。
 *
 * 处理流程：
 * 1. 标记 entry 为 PROCESSING
 * 2. 分块 + Embedding + 入库
 * 3. 标记 entry 为 COMPLETED（失败则 FAILED + 错误信息）
 * 4. 失效 Redis 条目缓存
 */
export async function startConsumer(): Promise<void> {
  const conn = await amqp.connect(config.rabbitmqUrl);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(1);

  console.log('[Consumer] Waiting for document processing jobs...');

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    const { entryId, text } = JSON.parse(msg.content.toString());
    const kbId = ''; // 从 entry 查询获取，用于缓存失效

    try {
      if (!text || !text.trim()) {
        throw new Error('Document text is empty — the file may be a scanned PDF with no text layer');
      }

      // 更新原文到 DB（确保最新）
      const entry = await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { content: text, processingStatus: 'PROCESSING' },
      });

      // 分块 + Embedding 入库
      const chunks = await chunkText(text);
      await embedAndStoreChunks(entryId, chunks);

      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { processingStatus: 'COMPLETED' },
      });

      // 失效条目缓存
      await cacheDelPattern(`entry:${entry.kbId}:*`);

      console.log(`[Consumer] Entry ${entryId} processed (${chunks.length} chunks)`);
      channel.ack(msg);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`[Consumer] Error processing entry ${entryId}:`, errorMessage);

      // 失效缓存（即使失败也要让前端看到状态更新）
      if (kbId) {
        await cacheDelPattern(`entry:${kbId}:*`).catch(() => {});
      }

      await prisma.knowledgeEntry
        .update({
          where: { id: entryId },
          data: {
            processingStatus: 'FAILED',
            processingMessage: errorMessage.slice(0, 500),
          },
        })
        .catch(() => {});
      channel.nack(msg, false, false);
    }
  });
}
