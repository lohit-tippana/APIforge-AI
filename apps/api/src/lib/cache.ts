import Redis from "ioredis";
import { config } from "../config";

interface CacheLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class MemoryCache implements CacheLike {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds = 300) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    if (this.store.size > 5000) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
  }

  async del(key: string) {
    this.store.delete(key);
  }
}

class RedisCache implements CacheLike {
  private client: Redis;
  constructor(url: string) {
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.connect().catch(() => {});
    this.client.on("error", () => {});
  }
  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds = 300) {
    await this.client.set(key, value, "EX", ttlSeconds);
  }
  async del(key: string) {
    await this.client.del(key);
  }
}

export const cache: CacheLike = config.redisUrl ? new RedisCache(config.redisUrl) : new MemoryCache();
