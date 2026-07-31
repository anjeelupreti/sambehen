import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_HEADER } from '../constants/app.constants';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[CORRELATION_HEADER] as string) || uuidv4();

    // Ensure it is set on request headers
    req.headers[CORRELATION_HEADER] = correlationId;

    // Set correlation ID on response headers for client tracking
    res.setHeader(CORRELATION_HEADER, correlationId);

    next();
  }
}
