/**
 * 自定义应用异常，携带业务错误码和 HTTP 状态码，
 * 由全局 error middleware 统一捕获并序列化为 API 响应。
 */
export class AppError extends Error {
  constructor(
    public code: number,
    message: string,
    public httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
