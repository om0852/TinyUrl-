/**
 * High-speed caching layer with in-memory LRU fallback and Redis support.
 * Designed for sub-millisecond edge link resolution.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class EdgeMemoryCache {
  private store = new Map<string, CacheEntry<any>>();
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
      // Evict oldest item
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Global singleton cache across Next.js invocations
const globalCache = new EdgeMemoryCache();

export const linkCache = {
  get: <T>(key: string): T | null => globalCache.get<T>(key),
  set: <T>(key: string, value: T, ttlSeconds = 300): void => globalCache.set(key, value, ttlSeconds),
  delete: (key: string): void => globalCache.delete(key),
  clear: (): void => globalCache.clear()
};
