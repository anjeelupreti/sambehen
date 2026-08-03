import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

// Config
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import redisConfig from '@config/redis.config';
import jwtConfig from '@config/jwt.config';
import mailConfig from '@config/mail.config';
import businessConfig from '@config/business.config';
import swaggerConfig from '@config/swagger.config';
import { validationSchema } from '@config/validation.schema';

// Database
import { DatabaseModule } from '@database/database.module';

// Shared modules
import { CacheModule } from '@shared/cache/cache.module';
import { SharedAuthModule } from '@shared/auth/auth.module';
import { HealthModule } from '@shared/health/health.module';
import { AppLoggerModule } from '@shared/logger/logger.module';
import { AuditModule } from '@shared/audit/audit.module';
import { MailerModule } from '@shared/mailer/mailer.module';
import { ScopeModule } from '@shared/scope/scope.module';
import { AuditInterceptor } from '@shared/audit/audit.interceptor';

// Cross-cutting HTTP concerns
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from '@common/interceptors/response-transform.interceptor';
import { TeamJwtGuard } from '@common/guards/team-jwt.guard';
import { RolesGuard } from '@common/guards/roles.guard';
// Feature modules
import { AuthModule } from '@modules/auth/auth.module';
import { StaffModule } from '@modules/staff/staff.module';
import { CustomersModule } from '@modules/customers/customers.module';
import { GamesModule } from '@modules/games/games.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';
import { VipModule } from '@modules/vip/vip.module';
import { SpinsModule } from '@modules/spins/spins.module';
import { ReferralsModule } from '@modules/referrals/referrals.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { EmailingModule } from '@modules/emailing/emailing.module';
import { ExportsModule } from '@modules/exports/exports.module';
import { AuditLogsModule } from '@modules/audit/audit-logs.module';

import { CorrelationIdMiddleware } from '@common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from '@common/middleware/request-logger.middleware';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        mailConfig,
        businessConfig,
        swaggerConfig,
      ],
      validationSchema,
      validationOptions: { abortEarly: false },
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    // ── Logging ────────────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: true,
        // Secrets must never reach the log sink, even at trace level.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.newPassword',
            'req.body.currentPassword',
          ],
          censor: '[REDACTED]',
        },
        customProps: () => ({ context: 'HTTP' }),
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),

    // ── Rate limiting ──────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL) || 60000,
        limit: Number(process.env.THROTTLE_LIMIT) || 100,
      },
    ]),

    // ── Background work ────────────────────────────────────────
    // @Cron drives the email dispatcher, VIP drift recompute, spin status
    // transitions and export builder. EventEmitter carries in-process
    // domain events (TransactionCreated -> VIP/referral recalculation).
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ global: true, verboseMemoryLeak: true }),

    // ── Core ───────────────────────────────────────────────────
    DatabaseModule,
    CacheModule,
    AppLoggerModule,
    SharedAuthModule,
    AuditModule,
    MailerModule,
    ScopeModule,
    HealthModule,

    // ── Feature modules ────────────────────────────────────────
    AuthModule,
    StaffModule,
    CustomersModule,
    GamesModule,
    TransactionsModule,
    VipModule,
    SpinsModule,
    ReferralsModule,
    MessagingModule,
    DashboardModule,
    EmailingModule,
    ExportsModule,
    AuditLogsModule,
  ],
  providers: [
    // Order matters. Guards run first (authenticate, then authorize), then
    // interceptors wrap the handler, and the filter catches whatever
    // escapes.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Team authentication is the default: a route is protected unless it
    // opts out with @Public() or swaps in @CustomerAuth(). Failing closed
    // means a new controller cannot ship unauthenticated by accident.
    { provide: APP_GUARD, useClass: TeamJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // '{*path}' rather than '*': Express 5 / path-to-regexp v8 no longer
    // accept a bare wildcard and only auto-convert it with a deprecation
    // warning on every registration.
    consumer.apply(CorrelationIdMiddleware, RequestLoggerMiddleware).forRoutes('{*path}');
  }
}
