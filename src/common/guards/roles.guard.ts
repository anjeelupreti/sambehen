import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/auth.decorators';
import { StaffRole } from '../constants/app.constants';
import { ErrorCode } from '../constants/error-codes';
import { CapabilityDeniedException } from '../exceptions/business.exception';
import { ICurrentStaff, isStaff } from '../interfaces/auth.interface';

/**
 * Enforces `@Roles(...)` capability checks on team routes.
 *
 * This answers "may this role perform this action" only. Whether the actor
 * may see a *particular row* is decided by ScopeService in the data layer,
 * and a row outside the actor's chain resolves to 404 rather than 403, so
 * the API never confirms that another manager's record exists.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: ICurrentStaff }>();
    const user = request.user;

    if (!isStaff(user)) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_WRONG_REALM,
        'This endpoint is restricted to team accounts',
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
