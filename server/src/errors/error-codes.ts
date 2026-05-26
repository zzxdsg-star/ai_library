/**
 * 业务错误码枚举，涵盖认证、知识管理、对话三大模块。
 * 0 表示成功，其余按千位分段区分模块。
 */
export const ErrorCodes = {
  SUCCESS: 0,

  // Auth 1xxx
  UNAUTHORIZED: 1001,
  INVALID_CREDENTIALS: 1002,
  USERNAME_EXISTS: 1003,

  // Knowledge 2xxx
  KB_NOT_FOUND: 2001,
  ENTRY_NOT_FOUND: 2002,
  DOCUMENT_PARSE_FAILED: 2003,

  // Chat 3xxx
  SESSION_NOT_FOUND: 3001,

  // Server 5xxx
  INTERNAL_ERROR: 5000,
} as const;
