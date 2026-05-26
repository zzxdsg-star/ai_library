import amqp from 'amqplib';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';
import { parseDocument } from '../ingestion/parser';
import { chunkText } from '../rag/chunker';
import { embedAndStoreChunks } from '../rag/embedder';

const QUEUE_NAME = 'document_processing';
const prisma = new PrismaClient();

/**
 * RabbitMQ Consumer：消费文档处理任务。
 *
 * 处理流程：
 * 1. 标记 entry 为 PROCESSING
 * 2. 解析文档提取纯文本
 * 3. 更新 entry.content
 * 4. 分块 + Embedding + 入库
 * 5. 标记 entry 为 COMPLETED（失败则 FAILED）
 */
export async function startConsumer(): Promise<void> {
  const conn = await amqp.connect(config.rabbitmqUrl);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(1); // 一次只取一条，避免并发过高

  console.log('[Consumer] Waiting for document processing jobs...');

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    const { entryId, filePath } = JSON.parse(msg.content.toString());

    try {
      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { processingStatus: 'PROCESSING' },
      });

      // 解析文档
      const text = await parseDocument(filePath);
      if (!text.trim()) {
        throw new Error('Document is empty or could not be parsed');
      }

      // 更新原文
      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { content: text },
      });

      // 分块 + Embedding 入库
      const chunks = await chunkText(text);
      await embedAndStoreChunks(entryId, chunks);

      await prisma.knowledgeEntry.update({
        where: { id: entryId },
        data: { processingStatus: 'COMPLETED' },
      });

      console.log(
        `[Consumer] Entry ${entryId} processed successfully (${chunks.length} chunks)`,
      );
      channel.ack(msg);
    } catch (error: any) {
      console.error(
        `[Consumer] Error processing entry ${entryId}:`,
        error.message,
      );
      await prisma.knowledgeEntry
        .update({
          where: { id: entryId },
          data: { processingStatus: 'FAILED' },
        })
        .catch(() => {}); // 忽略 DB 更新失败
      channel.nack(msg, false, false); // 不重新入队
    }
  });
}
