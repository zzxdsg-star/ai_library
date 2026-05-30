import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import svgCaptcha from 'svg-captcha';
import { authService } from '../services/auth.service';
import {
  authMiddleware,
  AuthRequest,
} from '../middleware/auth.middleware';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import type { LoginRequest, RegisterRequest } from 'shared';

const router = Router();

/**
 * GET /api/auth/captcha — 数学表达式 SVG 验证码。
 * 验证码答案存入 Redis (captcha:{id})，5 分钟有效，校验后立即删除。
 */
router.get('/captcha', (_req, res: Response) => {
  const captcha = svgCaptcha.createMathExpr({
    mathMin: 1,
    mathMax: 15,
    mathOperator: '+',
    width: 160,
    height: 50,
    fontSize: 40,
    color: true,
    noise: 2,
    background: '#fefdf9',
  });

  const id = crypto.randomUUID();
  cacheSet(`captcha:${id}`, captcha.text.toLowerCase(), 300);

  res.type('svg+xml');
  res.json({
    code: 0,
    data: { id, svg: captcha.data },
    message: 'ok',
  });
});

/**
 * POST /api/auth/register
 * 注册新用户，需验证码。成功后直接返回 JWT。
 */
router.post(
  '/register',
  async (req, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, captchaId, captchaCode } = req.body as RegisterRequest & { captchaId?: string; captchaCode?: string };
      await verifyCaptcha(captchaId, captchaCode);
      const result = await authService.register(username, email, password);
      res.json({ code: 0, data: result, message: 'ok' });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * POST /api/auth/login
 * 用户名/邮箱 + 密码 + 验证码登录，返回 JWT。
 */
router.post('/login', async (req, res: Response, next: NextFunction) => {
  try {
    const { username, password, captchaId, captchaCode } = req.body as LoginRequest & { captchaId?: string; captchaCode?: string };
    await verifyCaptcha(captchaId, captchaCode);
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

/**
 * 校验验证码：从 Redis 取出比对，命中后删除（一次性使用）。
 */
async function verifyCaptcha(id?: string, code?: string) {
  if (!id || !code) {
    throw new AppError(ErrorCodes.INVALID_CREDENTIALS, '请输入验证码', 400);
  }
  const stored = await cacheGet<string>(`captcha:${id}`);
  if (!stored || stored !== code.toLowerCase()) {
    throw new AppError(ErrorCodes.INVALID_CREDENTIALS, '验证码错误或已过期', 400);
  }
  await cacheDel(`captcha:${id}`);
}

export default router;
