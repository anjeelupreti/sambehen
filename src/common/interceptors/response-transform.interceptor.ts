import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { CORRELATION_HEADER } from '../constants/app.constants';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers[CORRELATION_HEADER] as string) || 'unknown';

    return next.handle().pipe(
      map((data) => {
        // If data is already in custom format or pagination format
        if (data && typeof data === 'object' && 'meta' in data && 'data' in data) {
          const paginated = data as Record<string, unknown>;
          return {
            success: true,
            message: 'Resource retrieved successfully',
            data: paginated['data'],
            meta: paginated['meta'],
            timestamp: new Date().toISOString(),
            correlationId,
          };
        }

        return {
          success: true,
          message: 'Operation successful',
          data,
          timestamp: new Date().toISOString(),
          correlationId,
        };
      }),
    );
  }
}
