/**
 * DEBUG 路由：仅后端调试使用，前端不调用。
 */
import { Router } from 'express';
import { cacheDelPattern } from '../cache/redis';

const router = Router();

/**
 * GET /api/debug/clear-cache — 清除所有 Redis 缓存。
 */
router.get('/clear-cache', async (_req, res) => {
  try {
    await cacheDelPattern('*');
    res.json({ code: 0, message: '所有 Redis 缓存已清除' });
  } catch (e) {
    res.status(500).json({ code: 5000, message: (e as Error).message });
  }
});

export default router;
