import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_HEADER } from '../constants/app.constants';
import { RequestContext } from '../context/request-context';

/**
 * Assigns a correlation id and binds the request context for the whole
 * async lifetime of the request.
 *
 * The id is echoed to the client, written into every log line, attached to
 * error envelopes and stored on audit rows, so a user-reported failure can
 * be traced to the exact server-side operation.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Honour an inbound id so a trace survives across services.
    const correlationId = (req.headers[CORRELATION_HEADER] as string) || uuidv4();

    req.headers[CORRELATION_HEADER] = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);

    // `next()` runs inside the store, so anything downstream — guards,
    // services, repositories — can read the context without it being
    // threaded through their signatures.
    RequestContext.run(
      {
        correlationId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        method: req.method,
        path: req.originalUrl ?? req.url,
      },
      () => next(),
    );
  }
}
