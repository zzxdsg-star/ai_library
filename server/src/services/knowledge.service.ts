import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../cache/redis';
import { deleteImage } from '../storage/oss';

/**
 * 知识管理服务：知识库 CRUD + 知识条目 CRUD。
 * 所有操作校验资源归属（userId），确保用户只能操作自己的知识库。
 *
 * Redis 缓存策略：
 * - 知识库列表/详情：缓存 5 分钟，写操作后失效
 * - 条目列表/详情：缓存 2 分钟，写操作后失效
 * - 缓存 key 格式：kb:{userId}, entry:{kbId}
 */
export class KnowledgeService {
  // ==================== Knowledge Bases ====================

  async createKB(userId: string, name: string, description?: string, systemPrompt?: string) {
    const kb = await prisma.knowledgeBase.create({
      data: { name, description, systemPrompt, userId },
    });
    await cacheDelPattern(`kb:${userId}:*`);
    return this.formatKB(kb);
  }

  async listKB(userId: string, page = 1, size = 10) {
    const cacheKey = `kb:${userId}:${page}:${size}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

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
    const result = { total, records: records.map(this.formatKB), current: page, size };
    // 空列表不缓存，避免删光数据后残留空缓存
    if (total > 0) {
      await cacheSet(cacheKey, result, 300);
    }
    return result;
  }

  async getKB(kbId: string, userId: string) {
    const cacheKey = `kb:detail:${kbId}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId },
    });
    if (!kb) {
      throw new AppError(ErrorCodes.KB_NOT_FOUND, '知识库不存在', 404);
    }
    const result = this.formatKB(kb);
    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async updateKB(kbId: string, userId: string, data: { name?: string; description?: string; systemPrompt?: string }) {
    await this.getKB(kbId, userId);
    const kb = await prisma.knowledgeBase.update({ where: { id: kbId }, data });
    // 失效相关缓存
    await Promise.all([cacheDelPattern(`kb:${userId}:*`), cacheDel(`kb:detail:${kbId}`)]);
    return this.formatKB(kb);
  }

  async deleteKB(kbId: string, userId: string) {
    await this.getKB(kbId, userId);
    // 删除前取出所有条目 ID，用于清理 OSS 图片
    const entries = await prisma.knowledgeEntry.findMany({
      where: { kbId },
      select: { id: true },
    });
    await prisma.knowledgeBase.delete({ where: { id: kbId } });
    // 异步清理 OSS 图片
    entries.forEach((e) => deleteImage(userId, e.id).catch((err) => console.error('OSS 删除失败:', err)));
    await Promise.all([cacheDelPattern(`kb:${userId}:*`), cacheDel(`kb:detail:${kbId}`), cacheDelPattern(`entry:${kbId}:*`), cacheDelPattern('analytics:*')]);
  }

  // ==================== Knowledge Entries ====================

  async createEntry(kbId: string, userId: string, title: string, content: string) {
    await this.getKB(kbId, userId);
    const entry = await prisma.knowledgeEntry.create({
      data: { kbId, title, content, type: 'MANUAL', processingStatus: 'PENDING' },
    });
    await cacheDelPattern(`entry:${kbId}:*`);
    return this.formatEntry(entry);
  }

  async listEntries(
    kbId: string, userId: string, page = 1, size = 10,
    search?: string, status?: string,
  ) {
    await this.getKB(kbId, userId);

    // 有搜索条件时不缓存（查询变化多，缓存命中率低）
    if (!search && !status) {
      const cacheKey = `entry:${kbId}:${page}:${size}`;
      const cached = await cacheGet<any>(cacheKey);
      if (cached) return cached;
    }

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
        where, orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * size, take: size,
      }),
    ]);
    const result = { total, records: records.map(this.formatEntry), current: page, size };

    if (!search && !status && total > 0) {
      await cacheSet(`entry:${kbId}:${page}:${size}`, result, 120);
    }
    return result;
  }

  async getEntry(entryId: string, userId: string) {
    const cacheKey = `entry:detail:${entryId}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    const result = this.formatEntry(entry);
    await cacheSet(cacheKey, result, 120);
    return result;
  }

  async updateEntry(entryId: string, userId: string, data: { title?: string; content?: string }) {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    const updated = await prisma.knowledgeEntry.update({ where: { id: entryId }, data });
    await Promise.all([cacheDelPattern(`entry:${entry.kbId}:*`), cacheDel(`entry:detail:${entryId}`)]);
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
    // 异步清理 OSS 图片（不阻塞响应）
    deleteImage(userId, entryId).catch((err) => console.error('OSS 删除失败:', err));
    // 同时失效分析统计缓存，确保热度排行实时反映删除变化
    await Promise.all([cacheDelPattern(`entry:${entry.kbId}:*`), cacheDel(`entry:detail:${entryId}`), cacheDelPattern('analytics:*')]);
  }

  async updateEntryStatus(entryId: string, userId: string, status: 'ENABLED' | 'DISABLED') {
    const entry = await prisma.knowledgeEntry.findFirst({
      where: { id: entryId, kb: { userId } },
    });
    if (!entry) {
      throw new AppError(ErrorCodes.ENTRY_NOT_FOUND, '知识条目不存在', 404);
    }
    const updated = await prisma.knowledgeEntry.update({
      where: { id: entryId }, data: { status },
    });
    await Promise.all([cacheDelPattern(`entry:${entry.kbId}:*`), cacheDel(`entry:detail:${entryId}`)]);
    return this.formatEntry(updated);
  }

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
      id: kb.id, name: kb.name, description: kb.description,
      system_prompt: kb.systemPrompt, user_id: kb.userId,
      created_at: kb.createdAt.toISOString(), updated_at: kb.updatedAt.toISOString(),
    };
  }

  private formatEntry(entry: any) {
    return {
      id: entry.id, kb_id: entry.kbId, title: entry.title,
      content: entry.content, type: entry.type, status: entry.status,
      processing_status: entry.processingStatus,
      processing_message: entry.processingMessage,
      source_file_name: entry.sourceFileName,
      source_file_hash: entry.sourceFileHash,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    };
  }
}

export const knowledgeService = new KnowledgeService();
