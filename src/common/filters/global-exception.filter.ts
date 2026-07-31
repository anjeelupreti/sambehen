import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { CORRELATION_HEADER } from '../constants/app.constants';
import { ErrorCode } from '../constants/error-codes';
import { ApiResponseDto } from '../dto/api-response.dto';
import { BusinessException, ErrorDetails } from '../exceptions/business.exception';

/** PostgreSQL SQLSTATE codes worth translating into a meaningful response. */
const PG_ERROR_MAP: Readonly<
  Record<string, { status: HttpStatus; code: ErrorCode; message: string }>
> = Object.freeze({
  // unique_violation
  '23505': {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.CONFLICT,
    message: 'A record with these details already exists',
  },
  // foreign_key_violation
  '23503': {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.VALIDATION_FAILED,
    message: 'A referenced record does not exist',
  },
  // not_null_violation
  '23502': {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.VALIDATION_FAILED,
    message: 'A required field was missing',
  },
  // check_violation
  '23514': {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.VALIDATION_FAILED,
    message: 'A value violates a database constraint',
  },
  // invalid_text_representation (e.g. malformed uuid)
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    code: ErrorCode.BAD_REQUEST,
    message: 'A value was not in the expected format',
  },
  // serialization_failure
  '40001': {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.CONFLICT,
    message: 'The operation conflicted with a concurrent change, please retry',
  },
});

interface IResolvedError {
  status: number;
  code: ErrorCode;
  message: string;
  details: ErrorDetails;
}

/**
 * Translates every thrown value into the standard error envelope.
 *
 * Registered globally as an APP_FILTER. Guarantees that:
 *  - the response shape matches {@link ApiResponseDto} on every path;
 *  - `error.code` is always a stable {@link ErrorCode};
 *  - 5xx responses never leak stack traces, SQL or driver text, while the
 *    full detail is logged against the request's correlation id.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers[CORRELATION_HEADER] as string) ?? 'unknown';

    const resolved = this.resolve(exception);

    const body: ApiResponseDto<never> = {
      success: false,
      statusCode: resolved.status,
      message: resolved.message,
      error: {
        code: resolved.code,
        details: resolved.details,
      },
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      correlationId,
    };

    const context = `${request.method} ${request.originalUrl ?? request.url}`;

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Unexpected: log everything. The client sees only a generic message
      // plus the correlation id linking back to this log line.
      this.logger.error(
        `[${correlationId}] ${context} -> ${resolved.status} ${resolved.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Expected: a warning is enough, no stack.
      this.logger.warn(`[${correlationId}] ${context} -> ${resolved.status} ${resolved.code}`);
    }

    response.status(resolved.status).json(body);
  }

  private resolve(exception: unknown): IResolvedError {
    // Application exceptions already carry a code and details.
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: this.extractMessage(exception),
        details: exception.details,
      };
    }

    // Framework exceptions (guards, 404 handler, throttler, ...).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: this.codeForStatus(status),
        message: this.extractMessage(exception),
        details: null,
      };
    }

    // Driver-level failures surfacing through drizzle.
    const sqlState = this.sqlState(exception);
    if (sqlState && PG_ERROR_MAP[sqlState]) {
      return { ...PG_ERROR_MAP[sqlState], details: null };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: null,
    };
  }

  /** Reads the SQLSTATE from a pg driver error, if this is one. */
  private sqlState(exception: unknown): string | undefined {
    if (typeof exception !== 'object' || exception === null) return undefined;
    const code = (exception as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  private extractMessage(exception: HttpException): string {
    const payload = exception.getResponse();

    if (typeof payload === 'string') return payload;

    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      // Nest's stock ValidationPipe yields string[]. The custom
      // exceptionFactory normally prevents that, but a bare
      // BadRequestException thrown elsewhere can still reach here.
      if (Array.isArray(message)) return message.join('; ');
    }

    return exception.message;
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_TOKEN_INVALID;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN_ROLE;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? ErrorCode.INTERNAL_ERROR
          : ErrorCode.BAD_REQUEST;
    }
  }
}
