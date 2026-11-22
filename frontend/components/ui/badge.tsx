import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        // Needs a human to act on it — distinct from suspended/banned
        // (outline/destructive), which are already-decided end states.
        warning: 'border-transparent bg-warning-surface text-warning',
        // A settled, healthy state: active, approved, rewarded.
        success: 'border-transparent bg-success/12 text-success',
        // Blocked but reversible (suspended) — softer than destructive,
        // which marks a final state such as banned.
        danger: 'border-transparent bg-destructive/10 text-destructive',
        highlight:
          'border-transparent bg-highlight/25 text-highlight-foreground dark:text-highlight',
        // Money direction, matching the tokens in globals.css. Neither is a
        // success or a failure state.
        debit: 'border-transparent bg-debit/10 text-debit',
        credit: 'border-transparent bg-credit/10 text-credit',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
