import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

/**
 * JWT 鉴权中间件。
 * 从 Authorization header 提取 Bearer token，验证后注入 req.user。
 * 不做 RBAC 检查，仅验证 token 有效性。
 */
export interface AuthRequest extends Request {
  user?: { id: string; username: string };
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, '未登录，请先登录', 401);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      id: string;
      username: string;
    };
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    throw new AppError(ErrorCodes.UNAUTHORIZED, '登录已过期，请重新登录', 401);
  }
}
