import { PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../cache/redis';

const prisma = new PrismaClient();

/**
 * 对话服务：会话 CRUD + 消息存储。
 * 首条用户消息自动设为会话标题（截取前 50 字符）。
 *
 * Redis 缓存策略：
 * - 会话列表：chat:sessions:{kbId}  2 分钟，创建/删除会话时失效
 * - 消息历史：chat:messages:{sId}   2 分钟，发送消息/删除会话时失效
 */
export class ChatService {
  async createSession(kbId: string, userId: string, title?: string) {
    const session = await prisma.chatSession.create({
      data: { kbId, userId, title: title || '新对话' },
    });
    await cacheDel(`chat:sessions:${kbId}`);
    return {
      id: session.id,
      kb_id: session.kbId,
      user_id: session.userId,
      title: session.title,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
    };
  }

  async listSessions(kbId: string, userId: string) {
    const cacheKey = `chat:sessions:${kbId}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const sessions = await prisma.chatSession.findMany({
      where: { kbId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    const result = sessions.map((s) => ({
      id: s.id,
      kb_id: s.kbId,
      user_id: s.userId,
      title: s.title,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));
    await cacheSet(cacheKey, result, 120);
    return result;
  }

  async getMessages(sessionId: string, userId: string) {
    const cacheKey = `chat:messages:${sessionId}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new AppError(ErrorCodes.SESSION_NOT_FOUND, '对话不存在', 404);
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    const result = messages.map((m) => ({
      id: m.id,
      session_id: m.sessionId,
      role: m.role,
      content: m.content,
      references: m.references as any,
      token_usage: m.tokenUsage as any,
      created_at: m.createdAt.toISOString(),
    }));
    await cacheSet(cacheKey, result, 120);
    return result;
  }

  async saveMessage(
    sessionId: string,
    role: 'USER' | 'ASSISTANT',
    content: string,
    references?: any,
    tokenUsage?: any,
  ) {
    const message = await prisma.chatMessage.create({
      data: { sessionId, role, content, references, tokenUsage },
    });

    // 首条用户消息自动设置会话标题
    if (role === 'USER') {
      const count = await prisma.chatMessage.count({
        where: { sessionId, role: 'USER' },
      });
      if (count === 1) {
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { title: content.slice(0, 50) },
        });
        // 标题变更需要清会话列表缓存
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: { kbId: true },
        });
        if (session) {
          await cacheDel(`chat:sessions:${session.kbId}`);
        }
      }
    }

    // 新消息写入，失效消息历史缓存
    await cacheDel(`chat:messages:${sessionId}`);

    return message;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new AppError(ErrorCodes.SESSION_NOT_FOUND, '对话不存在', 404);
    }
    await prisma.chatSession.delete({ where: { id: sessionId } });
    // 失效相关缓存
    await Promise.all([
      cacheDel(`chat:sessions:${session.kbId}`),
      cacheDel(`chat:messages:${sessionId}`),
    ]);
  }
}

export const chatService = new ChatService();
