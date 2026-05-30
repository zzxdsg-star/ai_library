/**
 * 后端服务入口。
 * 组装 Express 应用：CORS → JSON 解析 → 路由挂载 → 错误处理 → 启动监听。
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { config } from './config';
import { corsMiddleware } from './middleware/cors.middleware';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(corsMiddleware);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

import authRoutes from './routes/auth.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import chatRoutes from './routes/chat.routes';
import analyticsRoutes from './routes/analytics.routes';
import debugRoutes from './routes/debug.routes';
import { startConsumer } from './queue/consumer';

app.use('/api/auth', authRoutes);
app.use('/api/knowledge-bases', knowledgeRoutes);
app.use('/api/knowledge-bases', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/debug', debugRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

// 启动 RabbitMQ Consumer，处理文档异步入库
startConsumer().catch((err) => {
  console.error('[Consumer] Failed to start:', err.message);
});

export default app;
