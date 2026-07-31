import { AsyncLocalStorage } from 'node:async_hooks';

export interface IRequestContext {
  correlationId: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

/**
 * Ambient per-request context.
 *
 * Services that write audit entries need the correlation id, caller IP and
 * user agent, but threading a request object through every service
 * signature would leak HTTP concerns into the domain layer. AsyncLocalStorage
 * keeps the context available without that coupling, and is part of Node's
 * standard library rather than another dependency.
 *
 * Populated by CorrelationIdMiddleware, so it is set for the whole
 * lifetime of a request including any async continuation.
 */
const storage = new AsyncLocalStorage<IRequestContext>();

export const RequestContext = {
  /** Runs `callback` with `context` bound for its entire async lifetime. */
  run<T>(context: IRequestContext, callback: () => T): T {
    return storage.run(context, callback);
  },

  /**
   * The current request's context, or undefined outside a request —
   * background jobs and seeders have no HTTP context, and must still be
   * able to write audit entries.
   */
  get(): IRequestContext | undefined {
    return storage.getStore();
  },

  correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
};
