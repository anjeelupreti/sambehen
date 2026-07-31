import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CacheService } from '@shared/cache/cache.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const response = await this.cacheService.ping();
      if (response === 'PONG') {
        return this.getStatus(key, true);
      }
      throw new Error(`Unexpected ping response: ${response}`);
    } catch (error) {
      const exception = error as Error;
      throw new HealthCheckError(
        'Redis connection failed',
        this.getStatus(key, false, { message: exception.message }),
      );
    }
  }
}
