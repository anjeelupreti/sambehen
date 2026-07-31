import { Injectable, CanActivate } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '../constants/error-codes';
import { AuthenticationException } from '../exceptions/business.exception';
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
  handleRequest<TUser = ICurrentCustomer>(err: unknown, user: TUser | false, info: unknown): TUser {
    if (err || !user) {
      const name = (info as Error | undefined)?.name;

      if (name === 'TokenExpiredError') {
        throw new AuthenticationException(ErrorCode.AUTH_TOKEN_EXPIRED, 'Access token has expired');
      }
      if (name === 'NoAuthTokenError') {
        throw new AuthenticationException(
          ErrorCode.AUTH_TOKEN_MISSING,
          'Authorization header is missing',
        );
      }
      if (err instanceof AuthenticationException) {
        throw err;
      }

      throw new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID, 'Invalid access token');
    }

    return user;
  }
}
