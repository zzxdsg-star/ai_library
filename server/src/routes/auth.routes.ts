import { Router, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import {
  authMiddleware,
  AuthRequest,
} from '../middleware/auth.middleware';
import type { LoginRequest, RegisterRequest } from 'shared';

const router = Router();

/**
 * POST /api/auth/register
 * 注册新用户，成功后直接返回 JWT，无需再次登录。
 */
router.post(
  '/register',
  async (req, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body as RegisterRequest;
      const result = await authService.register(username, email, password);
      res.json({ code: 0, data: result, message: 'ok' });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * POST /api/auth/login
 * 用户名 + 密码登录，返回 JWT。
 */
router.post('/login', async (req, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as LoginRequest;
    const result = await authService.login(username, password);
    res.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息，需携带 JWT。
 */
router.get(
  '/me',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);
      res.json({ code: 0, data: user, message: 'ok' });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
