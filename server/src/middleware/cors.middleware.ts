import cors from 'cors';

/**
 * CORS 配置，仅允许前端开发服务器跨域访问。
 */
export const corsMiddleware = cors({
  origin: ['http://localhost:5173'],
  credentials: true,
});
