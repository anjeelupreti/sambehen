import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The window every product view on the landing page sits in. */
export function Frame({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-lp-line bg-lp-raised overflow-hidden rounded-xl border', className)}>
      <div className="border-lp-line flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {typeof action === 'string' ? (
          <span className="border-lp-line-strong text-lp-dim rounded-md border px-2.5 py-1 text-xs">
            {action}
          </span>
        ) : (
          action
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
