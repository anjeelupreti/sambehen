import { AuthRealm, StaffRole } from '../constants/app.constants';

/** Claims common to both realms. */
interface IJwtBasePayload {
  /** Subject - the staff or customer id. */
  sub: string;
  realm: AuthRealm;
  email: string;
  /** Session id, so a specific refresh chain can be revoked. */
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface ITeamJwtPayload extends IJwtBasePayload {
  realm: AuthRealm.TEAM;
  username: string;
  role: StaffRole;
  /** Managing staff id: master -> null, manager -> master, runner -> manager. */
  parentId: string | null;
}

export interface ICustomerJwtPayload extends IJwtBasePayload {
  realm: AuthRealm.CUSTOMER;
  username: string;
}

export type IJwtPayload = ITeamJwtPayload | ICustomerJwtPayload;

/**
 * Authenticated staff member, attached to `request.user` on team routes.
 * This is the actor every ScopeService call is resolved against.
 */
export interface ICurrentStaff {
  id: string;
  realm: AuthRealm.TEAM;
  email: string;
  username: string;
  role: StaffRole;
  parentId: string | null;
  sessionId?: string;
}

/** Authenticated customer, attached to `request.user` on customer routes. */
export interface ICurrentCustomer {
  id: string;
  realm: AuthRealm.CUSTOMER;
  email: string;
  username: string;
  sessionId?: string;
}

export type ICurrentUser = ICurrentStaff | ICurrentCustomer;

export function isStaff(user: ICurrentUser | undefined): user is ICurrentStaff {
  return user?.realm === AuthRealm.TEAM;
}

export function isCustomer(user: ICurrentUser | undefined): user is ICurrentCustomer {
  return user?.realm === AuthRealm.CUSTOMER;
}
