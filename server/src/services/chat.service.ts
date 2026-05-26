import { PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

const prisma = new PrismaClient();

/**
 * 对话服务：会话 CRUD + 消息存储。
 * 首条用户消息自动设为会话标题（截取前 50 字符）。
 */
export class ChatService {
  async createSession(kbId: string, userId: string, title?: string) {
    const session = await prisma.chatSession.create({
      data: { kbId, userId, title: title || '新对话' },
    });
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
    const sessions = await prisma.chatSession.findMany({
      where: { kbId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      kb_id: s.kbId,
      user_id: s.userId,
      title: s.title,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));
  }

  async getMessages(sessionId: string, userId: string) {
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
    return messages.map((m) => ({
      id: m.id,
      session_id: m.sessionId,
      role: m.role,
      content: m.content,
      references: m.references as any,
      token_usage: m.tokenUsage as any,
      created_at: m.createdAt.toISOString(),
    }));
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
      }
    }

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
  }
}

export const chatService = new ChatService();
