import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null; // 失败 3 次后放弃重连
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

const DEFAULT_TTL = 300; // 5 分钟默认 TTL

/**
 * 缓存读取：命中返回反序列化对象，未命中返回 null。
 * Redis 不可用时静默降级，不影响主业务。
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * 缓存写入，默认 5 分钟 TTL。
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttl: number = DEFAULT_TTL,
): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn('[Redis] Cache set failed:', (err as Error).message);
  }
}

/**
 * 删除缓存条目。
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.warn('[Redis] Cache delete failed:', (err as Error).message);
  }
}

/**
 * 按模式批量删除缓存（如 kb:abc123:* 匹配该用户所有知识库缓存页）。
 * 使用 SCAN 遍历匹配的 key 再批量 DEL，避免 KEYS 阻塞线上 Redis。
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    const keysToDelete: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  } catch (err) {
    console.warn('[Redis] Cache pattern delete failed:', (err as Error).message);
  }
}

export { redis };
