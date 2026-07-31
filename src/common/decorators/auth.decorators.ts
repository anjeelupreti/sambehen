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
