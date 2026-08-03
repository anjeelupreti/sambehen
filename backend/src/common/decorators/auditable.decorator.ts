import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface IAuditableOptions {
  /** Domain verb, e.g. 'customer.create', 'transaction.correction'. */
  action: string;
  /** Entity family the action targets, e.g. 'customer'. */
  entityType?: string;
  /**
   * Route param holding the entity id. Defaults to 'id'. Set to null for
   * actions that create the entity, where no id exists on the way in.
   */
  entityIdParam?: string | null;
}

/**
 * Marks a route for automatic audit logging.
 *
 *   @Auditable({ action: 'customer.password_reset', entityType: 'customer' })
 *
 * The interceptor records actor, target, request context and outcome.
 * Before/after snapshots need domain knowledge, so services capture those
 * by calling AuditService.record() directly.
 */
export const Auditable = (options: IAuditableOptions): CustomDecorator<string> =>
  SetMetadata(AUDITABLE_KEY, options);
