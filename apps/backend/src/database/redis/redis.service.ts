import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadAppConfig } from '../../config/app-config.js';
import { StructuredLogger } from '../../common/logging/logger.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly redisUrl: string;

  constructor(private readonly logger: StructuredLogger) {
    const config = loadAppConfig();
    this.redisUrl = config.redisUrl;
  }

  onModuleInit(): void {
    try {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 2000),
        lazyConnect: false,
      });

      this.client.on('error', (err) => {
        this.logger.warn({ message: `Redis connection error: ${err.message}`, context: 'RedisService' });
      });

      this.client.on('connect', () => {
        this.logger.log({ message: 'Connected to Redis', context: 'RedisService' });
      });
    } catch (err) {
      this.logger.warn({ message: `Failed to initialize Redis client: ${(err as Error).message}`, context: 'RedisService' });
    }
  }

  onModuleDestroy(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      });
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds && ttlSeconds > 0) {
      return this.getClient().set(key, value, 'EX', ttlSeconds);
    }
    return this.getClient().set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async incr(key: string): Promise<number> {
    return this.getClient().incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.getClient().expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }
}
