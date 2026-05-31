import { PrismaClient } from '@prisma/client';

/**
 * 全局共享 PrismaClient 单例。
 * 避免多个 new PrismaClient() 创建重复连接池。
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
