import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CORRELATION_HEADER } from '../constants/app.constants';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP_REQUEST');

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[CORRELATION_HEADER] as string) || 'unknown';
    this.logger.log(
      `[${correlationId}] Incoming request: ${req.method} ${req.originalUrl} | IP: ${req.ip} | User-Agent: ${req.get('user-agent') || 'none'}`,
    );
    next();
  }
}
