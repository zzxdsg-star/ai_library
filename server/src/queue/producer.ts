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
 * 文本已经在路由层解析完成，直接随消息传递，
 * 避免 Consumer 去 DB 读取时可能遇到的写延迟问题。
 */
export async function publishDocumentProcessing(
  entryId: string,
  text: string,
): Promise<void> {
  const ch = await getChannel();
  ch.sendToQueue(
    QUEUE_NAME,
    Buffer.from(JSON.stringify({ entryId, text })),
    { persistent: true },
  );
  console.log(`[RabbitMQ] Published job for entry: ${entryId}`);
}

export async function closeQueue(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
