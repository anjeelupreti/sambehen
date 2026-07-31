import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { UserRole } from '../constants/app.constants';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to enforce Role-Based Access Control on endpoints.
 */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
