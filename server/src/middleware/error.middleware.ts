import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

/**
 * 全局错误处理中间件。
 * 将 AppError 映射为统一响应格式，未知错误兜底为 500。
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      data: null,
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    code: ErrorCodes.INTERNAL_ERROR,
    message: '服务器内部错误',
    data: null,
  });
}
