import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CORRELATION_HEADER } from '../constants/app.constants';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { ApiResponseDto, PaginationMetaDto } from '../dto/api-response.dto';

/** Shape returned by paginated repository and service methods. */
interface IPaginatedPayload {
  data: unknown[];
  meta: PaginationMetaDto;
  summary?: Record<string, unknown>;
}

function isPaginated(value: unknown): value is IPaginatedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as IPaginatedPayload).data)
  );
}

const DEFAULT_MESSAGES: Readonly<Record<string, string>> = {
  GET: 'Request completed successfully',
  POST: 'Resource created successfully',
  PATCH: 'Resource updated successfully',
  PUT: 'Resource updated successfully',
  DELETE: 'Resource deleted successfully',
};

/**
 * Wraps every successful handler result in {@link ApiResponseDto}.
 *
 * Registered globally as an APP_INTERCEPTOR. Routes returning binary data
 * opt out with `@RawResponse()`; StreamableFile results are passed through
 * unconditionally as a second line of defence.
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const correlationId = (request.headers[CORRELATION_HEADER] as string) ?? 'unknown';
    const configuredMessage = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((payload) => {
        // Never wrap a stream: it would corrupt the file body.
        if (payload instanceof StreamableFile) {
          return payload;
        }

        const envelope: ApiResponseDto<unknown> = {
          success: true,
          statusCode: response.statusCode,
          message:
            configuredMessage ??
            DEFAULT_MESSAGES[request.method] ??
            'Request completed successfully',
          data: null,
          timestamp: new Date().toISOString(),
          path: request.originalUrl ?? request.url,
          correlationId,
        };

        if (isPaginated(payload)) {
          envelope.data = payload.data;
          envelope.meta = payload.meta;
          if (payload.summary !== undefined) {
            envelope.summary = payload.summary;
          }
          return envelope;
        }

        envelope.data = payload ?? null;
        return envelope;
      }),
    );
  }
}
