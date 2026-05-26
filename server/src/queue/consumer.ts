import amqp from 'amqplib';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';
import { chunkText } from '../rag/chunker';
import { embedAndStoreChunks } from '../rag/embedder';

const QUEUE_NAME = 'document_processing';
const prisma = new PrismaClient();

/**
 * RabbitMQ Consumer：消费文档处理任务。
 *
 * 处理流程（文件已在路由层解析，文本已写入 DB）：
 * 1. 从 DB 读取 entry.content（纯文本）
 * 2. 标记 entry 为 PROCESSING
 * 3. 分块 + Embedding + 入库
 * 4. 标记 entry 为 COMPLETED（失败则 FAILED）
 */
export async function startConsumer(): Promise<void> {
  const conn = await amqp.connect(config.rabbitmqUrl);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(1);

  console.log('[Consumer] Waiting for document processing jobs...');

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    const { entryId } = JSON.parse(msg.content.toString());

    try {
      // 读取已解析的文本
      const entry = await prisma.knowledgeEntry.findUnique({
        where: { id: entryId },
      });
      if (!entry || !entry.content.trim()) {
        throw new Error('Entry has no text content');
      }

      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { processingStatus: 'PROCESSING' },
      });

      // 分块 + Embedding 入库
      const chunks = await chunkText(entry.content);
      await embedAndStoreChunks(entryId, chunks);

      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { processingStatus: 'COMPLETED' },
      });

      console.log(
        `[Consumer] Entry ${entryId} processed (${chunks.length} chunks)`,
      );
      channel.ack(msg);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';
      console.error(
        `[Consumer] Error processing entry ${entryId}:`,
        errorMessage,
      );
      await prisma.knowledgeEntry
        .update({
          where: { id: entryId },
          data: {
            processingStatus: 'FAILED',
            processingMessage: errorMessage.slice(0, 500), // 截断过长错误信息
          },
        })
        .catch(() => {});
      channel.nack(msg, false, false);
    }
  });
}
