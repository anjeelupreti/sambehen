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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers[CORRELATION_HEADER] as string) || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errorDetail = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse();
      if (typeof resContent === 'string') {
        message = resContent;
      } else if (resContent && typeof resContent === 'object') {
        const obj = resContent as Record<string, unknown>;
        message = (obj['message'] as string) || exception.message;
        errorDetail = (obj['error'] as string) || errorDetail;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorDetail = exception.name;
    }

    // Database error handling (Drizzle/pg exceptions)
    const errObj = exception as Record<string, unknown>;
    if (errObj && typeof errObj === 'object') {
      if (errObj['code'] === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'Database Conflict: Resource already exists';
        errorDetail = 'UniqueConstraintViolation';
      } else if (errObj['code'] === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database Error: Foreign key constraint violation';
        errorDetail = 'ForeignKeyViolation';
      }
    }

    // Log the error with details
    this.logger.error(
      `[${correlationId}] Route: ${request.method} ${request.url} - Error: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      message,
      error: errorDetail,
      timestamp: new Date().toISOString(),
      correlationId,
    });
  }
}
