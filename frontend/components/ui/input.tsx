import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * `suppressHydrationWarning` is here for password managers.
 *
 * Extensions like 1Password, LastPass and Bitwarden stamp their own
 * attributes (`data-has-listeners` and friends) onto form fields before
 * React hydrates, so the client markup no longer matches what the server
 * sent and React logs a hydration mismatch on every sign-in page.
 *
 * Nothing is broken by it — React cannot patch attributes either way, and
 * the field works — but the warning is noise that hides real mismatches.
 * The suppression applies only to this element's own attributes, not to its
 * children, so a genuine mismatch anywhere else still surfaces.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      suppressHydrationWarning
      type={type}
      data-slot="input"
      className={cn(
        'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
