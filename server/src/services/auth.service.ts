import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

const prisma = new PrismaClient();

/**
 * 认证服务：注册、登录、获取当前用户。
 * JWT 有效期 7 天，存储用户 id 和 username。
 */
export class AuthService {
  async register(username: string, email: string, password: string) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      throw new AppError(
        ErrorCodes.USERNAME_EXISTS,
        '用户名或邮箱已存在',
        409,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    const token = this.generateToken(user.id, user.username);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.createdAt.toISOString(),
      },
    };
  }

  async login(username: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
    });
    if (!user) {
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        '用户名或密码错误',
        401,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        '用户名或密码错误',
        401,
      );
    }

    const token = this.generateToken(user.id, user.username);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.createdAt.toISOString(),
      },
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '用户不存在', 404);
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.createdAt.toISOString(),
    };
  }

  /**
   * 生成 JWT，7 天有效期。
   */
  private generateToken(id: string, username: string): string {
    return jwt.sign({ id, username }, config.jwtSecret, { expiresIn: '7d' });
  }
}

export const authService = new AuthService();
