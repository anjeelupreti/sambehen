import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { StaffRole } from '../constants/app.constants';
import { TeamJwtGuard } from '../guards/team-jwt.guard';
import { CustomerJwtGuard } from '../guards/customer-jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles, CustomerRealm } from './auth.decorators';
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
 * The `CustomerRealm()` marker is essential, not decorative: global guards
 * run before route-level ones, so the globally registered TeamJwtGuard
 * would otherwise verify a customer token against the team secret and
 * reject it as an invalid signature, making every customer route
 * unreachable. The marker tells the team guard to stand aside so
 * CustomerJwtGuard can authenticate.
 *
 * A staff token is still rejected here, because CustomerJwtGuard verifies
 * against the customer secret.
 */
export function CustomerAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    CustomerRealm(),
    UseGuards(CustomerJwtGuard),
    ApiBearerAuth(CUSTOMER_BEARER),
    ApiUnauthorizedResponse({ description: 'Missing, expired or invalid customer access token' }),
  );
}
