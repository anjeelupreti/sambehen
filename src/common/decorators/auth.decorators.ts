import {
  SetMetadata,
  CustomDecorator,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffRole } from '../constants/app.constants';
import { ICurrentStaff, ICurrentCustomer, ICurrentUser } from '../interfaces/auth.interface';

export const IS_PUBLIC_KEY = 'is_public';
export const ROLES_KEY = 'staff_roles';

/**
 * Marks a route as belonging to the customer realm.
 *
 * Set by `@CustomerAuth()`. The globally registered TeamJwtGuard runs
 * before any route-level guard, so without this marker it would try to
 * verify a customer token against the TEAM secret and reject it as an
 * invalid signature — making every customer route unreachable. Seeing this
 * key, the team guard stands aside and lets CustomerJwtGuard authenticate.
 */
export const CUSTOMER_AUTH_KEY = 'customer_auth';

/**
 * Declares a route as customer-realm without attaching a guard.
 *
 * Prefer `@CustomerAuth()`, which applies this together with the guard and
 * the Swagger security scheme. Exported separately so the marker and the
 * guard can never be reasoned about independently.
 */
export const CustomerRealm = (): CustomDecorator<string> => SetMetadata(CUSTOMER_AUTH_KEY, true);

/**
 * Marks a route as unauthenticated.
 *
 * The team JWT guard is registered globally, so every route requires a
 * valid staff token unless it opts out with this decorator or is placed
 * behind the customer guard instead.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts a team route to specific staff roles.
 *
 * Capability check only — it answers "may this role perform this action",
 * never "may this actor see this row". Row-level access is decided by
 * ScopeService, which composes a SQL predicate in the data layer.
 */
export const Roles = (...roles: StaffRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated staff member. Use on team routes. */
export const CurrentStaff = createParamDecorator(
  (data: keyof ICurrentStaff | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: ICurrentStaff }>();
    const staff = request.user;
    return data && staff ? staff[data] : staff;
  },
);

/** Injects the authenticated customer. Use on customer-portal routes. */
export const CurrentCustomer = createParamDecorator(
  (data: keyof ICurrentCustomer | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: ICurrentCustomer }>();
    const customer = request.user;
    return data && customer ? customer[data] : customer;
  },
);

/** Injects whichever principal authenticated, regardless of realm. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ICurrentUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: ICurrentUser }>();
    return request.user;
  },
);
