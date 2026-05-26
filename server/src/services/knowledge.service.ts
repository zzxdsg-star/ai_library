import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

const prisma = new PrismaClient();

/**
 * 知识管理服务：知识库 CRUD + 知识条目 CRUD。
 * 所有操作校验资源归属（userId），确保用户只能操作自己的知识库。
 */
export class KnowledgeService {
  // ==================== Knowledge Bases ====================

  async createKB(userId: string, name: string, description?: string, systemPrompt?: string) {
    const kb = await prisma.knowledgeBase.create({
      data: { name, description, systemPrompt, userId },
    });
    return this.formatKB(kb);
  }

  async listKB(userId: string, page = 1, size = 10) {
    const where = { userId };
    const [total, records] = await Promise.all([
      prisma.knowledgeBase.count({ where }),
      prisma.knowledgeBase.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return {
      total,
      records: records.map(this.formatKB),
      current: page,
      size,
    };
  }

  async getKB(kbId: string, userId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId },
    });
    if (!kb) {
      throw new AppError(ErrorCodes.KB_NOT_FOUND, '知识库不存在', 404);
    }
    return this.formatKB(kb);
  }

  async updateKB(kbId: string, userId: string, data: { name?: string; description?: string; systemPrompt?: string }) {
    await this.getKB(kbId, userId); // 校验存在 + 归属
    const kb = await prisma.knowledgeBase.update({
      where: { id: kbId },
      data,
    });
    return this.formatKB(kb);
  }

  async deleteKB(kbId: string, userId: string) {
    await this.getKB(kbId, userId);
    await prisma.knowledgeBase.delete({ where: { id: kbId } });
  }

  // ==================== Knowledge Entries ====================

  async createEntry(kbId: string, userId: string, title: string, content: string) {
    await this.getKB(kbId, userId);
    const entry = await prisma.knowledgeEntry.create({
      data: { kbId, title, content, type: 'MANUAL', processingStatus: 'PENDING' },
    });
    return this.formatEntry(entry);
  }

  async listEntries(
    kbId: string,
    userId: string,
    page = 1,
    size = 10,
    search?: string,
    status?: string,
  ) {
    await this.getKB(kbId, userId);
    const where: Prisma.KnowledgeEntryWhereInput = { kbId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status as 'ENABLED' | 'DISABLED';
    }

    const [total, records] = await Promise.all([
      prisma.knowledgeEntry.count({ where }),
      prisma.knowledgeEntry.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return {
      total,
      records: records.map(this.formatEntry),
      current: page,
      size,
    };
  }

  async getEntry(entryId: string, userId: string) {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    return this.formatEntry(entry);
  }

  async updateEntry(entryId: string, userId: string, data: { title?: string; content?: string }) {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    const updated = await prisma.knowledgeEntry.update({
      where: { id: entryId },
      data,
    });
    return this.formatEntry(updated);
  }

  async deleteEntry(entryId: string, userId: string) {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    await prisma.knowledgeEntry.delete({ where: { id: entryId } });
  }

  async updateEntryStatus(entryId: string, userId: string, status: 'ENABLED' | 'DISABLED') {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    const updated = await prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: { status },
    });
    return this.formatEntry(updated);
  }

  /**
   * 获取条目所有已启用的分块（用于检索）。
   */
  async getEntryChunks(entryId: string, userId: string) {
    await this.getEntry(entryId, userId);
    return prisma.knowledgeChunk.findMany({
      where: { entryId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  // ==================== Formatters ====================

  private formatKB(kb: any) {
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description,
      system_prompt: kb.systemPrompt,
      user_id: kb.userId,
      created_at: kb.createdAt.toISOString(),
      updated_at: kb.updatedAt.toISOString(),
    };
  }

  private formatEntry(entry: any) {
    return {
      id: entry.id,
      kb_id: entry.kbId,
      title: entry.title,
      content: entry.content,
      type: entry.type,
      status: entry.status,
      processing_status: entry.processingStatus,
      source_file_name: entry.sourceFileName,
      source_file_hash: entry.sourceFileHash,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    };
  }
}

export const knowledgeService = new KnowledgeService();
