import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const commandTimeout = parseInt(
      this.configService.get<string>('REDIS_COMMAND_TIMEOUT') || '5000',
      10,
    );
    const connectTimeout = parseInt(
      this.configService.get<string>('REDIS_CONNECT_TIMEOUT') || '10000',
      10,
    );

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout,
      connectTimeout,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn(
            `Redis connection failed after ${times} attempts, will keep retrying`,
          );
          return 5000;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.warn(`Redis error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      if (ttl) {
        await this.client.set(key, value, 'EX', ttl);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // Silently fail - caching is optional
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch {
      // Silently fail
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.keys(pattern);
    } catch {
      return [];
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Silently fail
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
