import { Redis } from '@upstash/redis';

/**
 * Two-Tiered Hybrid Caching Engine:
 * - L1: In-memory Edge LRU Map (sub-millisecond reads for hot links on local worker)
 * - L2: Upstash Redis (distributed cluster across all edge nodes & serverless containers)
 * - L3: Neon PostgreSQL (persistent source of truth)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Link and domain rows change when someone edits them, but a delete only clears L1 on the
// instance that handled the edit. Other serverless instances keep their copy, so those rows live
// in L1 only briefly; a longer TTL kept serving an old redirect type (splash after switching to
// direct) for minutes. Redis, when configured, still holds them for the full TTL.
const L1_ROW_MAX_TTL_SECONDS = 10;
const isRowKey = (key: string) => key.startsWith('link_') || key.startsWith('domain_');

class EdgeMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxItems = 5000;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    if (this.store.size >= this.maxItems) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const ttl = isRowKey(key) ? Math.min(ttlSeconds, L1_ROW_MAX_TTL_SECONDS) : ttlSeconds;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Global in-memory singleton
const l1Cache = new EdgeMemoryCache();

// Initialize Upstash Redis client with graceful fallback
let redisInstance: Redis | null = null;

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      redisInstance = new Redis({
        url: url.trim(),
        token: token.trim(),
        retry: {
          retries: 2,
          backoff: (retryCount) => Math.exp(retryCount) * 50
        }
      });
    } catch (err) {
      console.warn('Failed to initialize Upstash Redis client, falling back to L1 in-memory cache:', err);
    }
  }

  return redisInstance;
}

function prefixKey(key: string): string {
  return key.startsWith('snip:') ? key : `snip:${key}`;
}

export const linkCache = {
  /**
   * Synchronous L1 in-memory lookup.
   * Returns immediately without async overhead.
   */
  getSync: <T>(key: string): T | null => {
    return l1Cache.get<T>(key);
  },

  /**
   * Two-tier lookup:
   * 1. Check L1 in-memory cache (instant < 0.5ms).
   * 2. If missed, query L2 Upstash Redis (5-15ms).
   * 3. If found in Redis, backfill L1 cache.
   */
  get: async <T>(key: string): Promise<T | null> => {
    // 1. Check L1 (local process memory)
    const local = l1Cache.get<T>(key);
    if (local !== null) {
      return local;
    }

    // 2. Check L2 (Upstash Redis)
    const redis = getRedis();
    if (!redis) return null;

    try {
      const pKey = prefixKey(key);
      const val = await redis.get<T>(pKey);
      if (val !== null && val !== undefined) {
        // Backfill L1 with conservative TTL (120s)
        l1Cache.set(key, val, 120);
        return val;
      }
    } catch (err) {
      // Non-blocking: fail gracefully to return null so caller queries PostgreSQL
      console.warn(`[Redis Cache] Get failed for "${key}", falling back:`, err);
    }

    return null;
  },

  /**
   * Two-tier write:
   * 1. Immediately populates L1 in-memory cache.
   * 2. Asynchronously sets in Upstash Redis with expiration.
   */
  set: async <T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> => {
    // 1. Set L1 memory immediately
    l1Cache.set(key, value, ttlSeconds);

    // 2. Set L2 Upstash Redis
    const redis = getRedis();
    if (!redis) return;

    try {
      const pKey = prefixKey(key);
      await redis.set(pKey, value, { ex: Math.max(1, ttlSeconds) });
    } catch (err) {
      console.warn(`[Redis Cache] Set failed for "${key}":`, err);
    }
  },

  /**
   * Two-tier delete:
   * Invalidates both local L1 memory and distributed Redis key globally.
   */
  delete: async (key: string): Promise<void> => {
    l1Cache.delete(key);

    const redis = getRedis();
    if (!redis) return;

    try {
      const pKey = prefixKey(key);
      await redis.del(pKey);
    } catch (err) {
      console.warn(`[Redis Cache] Delete failed for "${key}":`, err);
    }
  },

  /**
   * Atomic SETNX for distributed deduplication (e.g. click beacon deduplication).
   * Returns true if the key was set (new event), false if it already existed within ttlSeconds.
   */
  setNx: async (key: string, value: unknown = '1', ttlSeconds: number = 60): Promise<boolean> => {
    // Check L1 first for local speed
    if (l1Cache.get(key) !== null) {
      return false;
    }
    l1Cache.set(key, value, ttlSeconds);

    const redis = getRedis();
    if (!redis) return true; // fallback to true if Redis is unavailable

    try {
      const pKey = prefixKey(key);
      const res = await redis.set(pKey, value, { ex: Math.max(1, ttlSeconds), nx: true });
      return res === 'OK';
    } catch (err) {
      console.warn(`[Redis Cache] setNx failed for "${key}":`, err);
      return true;
    }
  },

  /**
   * Clears L1 local memory.
   */
  clear: (): void => {
    l1Cache.clear();
  },

  /**
   * Pings Redis to check connectivity and latency.
   */
  ping: async (): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
    const redis = getRedis();
    if (!redis) {
      return { ok: false, latencyMs: 0, error: 'Redis client not configured (missing URL/Token)' };
    }
    const start = Date.now();
    try {
      const pong = await redis.ping();
      const latencyMs = Date.now() - start;
      return { ok: pong === 'PONG', latencyMs };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  },

  /**
   * Direct access to Upstash Redis client.
   */
  getRedisClient: (): Redis | null => getRedis()
};
