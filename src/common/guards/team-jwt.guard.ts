import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { AuthenticationException } from '../exceptions/business.exception';
import { resolveAuthError } from './jwt-error.util';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { JWT_TEAM_STRATEGY } from '@shared/auth/strategies/jwt-team.strategy';
import { ICurrentStaff } from '../interfaces/auth.interface';

/**
 * Authenticates business-side requests against the team JWT strategy.
 *
 * Registered globally, so team authentication is the default and a route
 * must deliberately opt out via `@Public()` or `@CustomerAuth()`. Failing
 * closed like this means a new controller cannot accidentally ship
 * unauthenticated.
 */
@Injectable()
export class TeamJwtGuard extends AuthGuard(JWT_TEAM_STRATEGY) implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  /**
   * Converts passport failures into specific, actionable errors.
   *
   * `handleRequest` receives the ExecutionContext, so the raw header can
   * be inspected: passport-jwt reports a missing token as a plain
   * `Error('No auth token')` whose name is just 'Error', which is not
   * distinguishable by name alone.
   */
  handleRequest<TUser = ICurrentStaff>(
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
