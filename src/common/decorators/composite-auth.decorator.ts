import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { StaffRole } from '../constants/app.constants';
import { TeamJwtGuard } from '../guards/team-jwt.guard';
import { CustomerJwtGuard } from '../guards/customer-jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './auth.decorators';
import { TEAM_BEARER, CUSTOMER_BEARER } from '../swagger/swagger.constants';

/**
 * Protects a team route and, optionally, restricts it to specific roles.
 *
 *   @TeamAuth(StaffRole.MASTER)                  master only
 *   @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
 *   @TeamAuth()                                  any authenticated staff
 *
 * Bundles the guard, the role metadata and the Swagger security scheme so
 * they can never drift apart — a route documented as master-only is
 * enforced as master-only by construction.
 */
export function TeamAuth(...roles: StaffRole[]): MethodDecorator & ClassDecorator {
  const decorators = [
    UseGuards(TeamJwtGuard, RolesGuard),
    ApiBearerAuth(TEAM_BEARER),
    ApiUnauthorizedResponse({ description: 'Missing, expired or invalid team access token' }),
  ];

  if (roles.length > 0) {
    decorators.push(
      Roles(...roles),
      ApiForbiddenResponse({ description: `Requires role: ${roles.join(' or ')}` }),
    );
  }

  return applyDecorators(...decorators);
}

/**
 * Protects a customer-portal route.
 *
 * Applying an explicit guard also overrides the globally registered team
 * guard for this handler, so a staff token is rejected here just as a
 * customer token is rejected on team routes.
 */
export function CustomerAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(CustomerJwtGuard),
    ApiBearerAuth(CUSTOMER_BEARER),
    ApiUnauthorizedResponse({ description: 'Missing, expired or invalid customer access token' }),
  );
}
