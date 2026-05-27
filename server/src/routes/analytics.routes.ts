import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { analyticsService } from '../services/analytics.service';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/analytics/overview
 * 全局概览：热门条目 TOP 10 + 知识库活跃度排行 + 基础统计。
 */
router.get('/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getOverview(req.user!.id);
    res.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/analytics/kb/:id
 * 单库统计：该知识库下的热门条目排行。
 */
router.get('/kb/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getKBStats(req.params.id as string, req.user!.id);
    if (!data) {
      res.status(404).json({ code: 2001, message: '知识库不存在', data: null });
      return;
    }
    res.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

export default router;
