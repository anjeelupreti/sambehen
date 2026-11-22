import type { badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/**
 * How a customer status is shown, everywhere it appears. One mapping so a
 * status never reads differently on two screens:
 * active is healthy, pending needs a person, inactive is neutral (a lapse,
 * not a block), suspended is blocked but reversible, banned is final.
 */
export const CUSTOMER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  pending: 'warning',
  inactive: 'secondary',
  suspended: 'danger',
  banned: 'destructive',
};
