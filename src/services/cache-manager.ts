/**
 * Cache Manager Implementation
 * In-memory cache implementation for query results
 */

import { CacheManager } from '../interfaces/services';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCacheManager implements CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;

  constructor(defaultTTL = 300) {
    // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -1;

    const remaining = Math.max(0, entry.expiresAt - Date.now());
    return Math.floor(remaining / 1000);
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async deletePattern(pattern: string): Promise<number> {
    const keysToDelete = await this.keys(pattern);
    let deletedCount = 0;

    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// Export both the interface and implementation
export { CacheManager } from '../interfaces/services';
