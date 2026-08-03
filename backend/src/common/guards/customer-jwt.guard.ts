import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthenticationException } from '../exceptions/business.exception';
import { resolveAuthError } from './jwt-error.util';
import { JWT_CUSTOMER_STRATEGY } from '@shared/auth/strategies/jwt-customer.strategy';
import { ICurrentCustomer } from '../interfaces/auth.interface';

/**
 * Authenticates customer-portal requests.
 *
 * Applied explicitly per route (via `@CustomerAuth()`), which also
 * suppresses the globally registered team guard for that handler.
 */
@Injectable()
export class CustomerJwtGuard extends AuthGuard(JWT_CUSTOMER_STRATEGY) implements CanActivate {
  handleRequest<TUser = ICurrentCustomer>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      if (err instanceof AuthenticationException) {
        throw err;
      }
      throw resolveAuthError(info, context.switchToHttp().getRequest<Request>());
    }

    return user;
  }
}
