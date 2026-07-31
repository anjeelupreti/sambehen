import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Public } from '@common/decorators/auth.decorators';
import { RawResponse } from '@common/decorators/raw-response.decorator';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dbIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /**
   * Liveness and readiness probe.
   *
   * `@Public()` because team authentication is the global default and a
   * load balancer or orchestrator has no credentials to present.
   *
   * `@RawResponse()` because probes expect terminus's own
   * `{ status, info, details }` document. Wrapping it in the API envelope
   * would break every off-the-shelf health check, and terminus signals
   * failure by throwing, so the standard error envelope would mask a 503
   * behind a shape probes do not understand.
   */
  @Get()
  @Public()
  @RawResponse()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness and readiness probe',
    description:
      'Checks database and redis connectivity. Public and unwrapped, for container orchestration.',
  })
  @ApiOkResponse({ description: 'All dependencies reachable' })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies are unreachable' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.dbIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
