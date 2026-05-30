import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/ai_knowledge',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  bailian: {
    apiKey: process.env.BAILIAN_API_KEY || '',
    embeddingModel: 'text-embedding-v3',
    llmModel: 'qwen-plus',
    visionModel: 'qwen-vl-plus',
  },
  oss: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || 'my-ai-library',
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  },
};
