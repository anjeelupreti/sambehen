import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Permission } from '../constants/app.constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Permissions decorator to enforce fine-grained Permission-Based Access Control on endpoints.
 */
export const Permissions = (...permissions: Permission[]): CustomDecorator<string> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
