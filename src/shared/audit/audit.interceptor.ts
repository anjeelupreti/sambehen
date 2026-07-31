import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AUDITABLE_KEY, IAuditableOptions } from '@common/decorators/auditable.decorator';
import { CORRELATION_HEADER, AuthRealm } from '@common/constants/app.constants';
import { ICurrentUser, isStaff } from '@common/interfaces/auth.interface';
import { AuditService } from './audit.service';

/**
 * Writes an audit entry for routes marked with `@Auditable(...)`.
 *
 * Captures actor, target, request context and outcome. Domain-level
 * before/after snapshots are the service layer's job, since only it knows
 * what the prior state was — those calls go through AuditService directly
 * and are merged by entity id.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<IAuditableOptions>(AUDITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: ICurrentUser }>();
    const response = http.getResponse<Response>();
    const user = request.user;

    const entityIdParam = options.entityIdParam === undefined ? 'id' : options.entityIdParam;
    const paramId = entityIdParam
      ? (request.params as Record<string, string | undefined>)[entityIdParam]
      : undefined;

    return next.handle().pipe(
      tap({
        next: (payload) => {
          // Creates have no id on the way in, so fall back to the id the
          // handler returned.
          const resultId = this.extractId(payload);

          void this.auditService.record({
            actorType: user ? user.realm : 'system',
            actorId: user?.id ?? null,
            actorRole: isStaff(user) ? user.role : user ? AuthRealm.CUSTOMER : null,
            action: options.action,
            entityType: options.entityType ?? null,
            entityId: paramId ?? resultId ?? null,
            after: this.auditService.redact(request.body) as Record<string, unknown>,
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            ip: request.ip ?? null,
            userAgent: request.get('user-agent') ?? null,
            correlationId: (request.headers[CORRELATION_HEADER] as string) ?? null,
          });
        },
      }),
    );
  }

  private extractId(payload: unknown): string | undefined {
    if (payload && typeof payload === 'object' && 'id' in payload) {
      const id = (payload as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    }
    return undefined;
  }
}
