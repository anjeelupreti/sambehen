import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redisClient!: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);

    this.redisClient = new Redis({
      host,
      port,
      password,
      db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on('connect', () => {
      this.logger.log('✅ Connected to Redis cache service');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('❌ Redis cache service error', err);
    });

    // Fire connection
    this.redisClient.connect().catch((err) => {
      this.logger.error('❌ Failed to connect to Redis', err);
    });
  }

  /**
   * Shutdown must tolerate a client that was never built.
   *
   * `NestFactory.create()` instantiates the graph but does NOT fire
   * `onModuleInit` — only `init()` or `listen()` does — while `close()`
   * fires `onModuleDestroy` regardless. Anything that builds the app
   * without serving it (the openapi.json script) therefore reaches this
   * hook with no client, and an unguarded `.quit()` turned a clean exit
   * into a crash.
   */
  async onModuleDestroy(): Promise<void> {
    const client: Redis | undefined = this.redisClient;
    if (!client) return;

    try {
      await client.quit();
    } catch {
      // `quit()` rejects when the socket never opened or has already gone
      // away. Shutting down is not a good moment to fail over a connection
      // that is already closed, so drop it and move on.
      client.disconnect();
    }
  }

  /**
   * Get value by key from cache.
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Set cache key to value with optional TTL.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringified = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const ttl = ttlSeconds || this.configService.get<number>('redis.ttl', 300);

    if (ttl > 0) {
      await this.redisClient.set(key, stringified, 'EX', ttl);
    } else {
      await this.redisClient.set(key, stringified);
    }
  }

  /**
   * Delete key from cache.
   */
  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  /**
   * Check connection status.
   */
  async ping(): Promise<string> {
    return this.redisClient.ping();
  }
}
