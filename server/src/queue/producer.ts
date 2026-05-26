import amqp, { type Channel } from 'amqplib';
import { config } from '../config';

const QUEUE_NAME = 'document_processing';

let connection: amqp.ChannelModel | null = null;
let channel: Channel | null = null;

async function getChannel(): Promise<Channel> {
  if (!channel) {
    connection = await amqp.connect(config.rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('[RabbitMQ] Producer connected, queue:', QUEUE_NAME);
  }
  return channel;
}

/**
 * 发布文档处理任务到 RabbitMQ。
 * 仅传 entryId，文本内容已由路由层解析并写入 DB。
 * Consumer 收到后直接从 DB 读取文本进行分块+Embedding。
 */
export async function publishDocumentProcessing(
  entryId: string,
): Promise<void> {
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({ entryId })), {
    persistent: true,
  });
  console.log(`[RabbitMQ] Published job for entry: ${entryId}`);
}

export async function closeQueue(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
