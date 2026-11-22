import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * One headline number with its label, an optional change against the
 * previous period, and an optional line of context.
 */
export function StatCard({
  label,
  value,
  hint,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Percent change against the previous period. */
  trend?: number | null;
  className?: string;
}) {
  const hasTrend = trend !== undefined && trend !== null;
  const TrendIcon =
    !hasTrend || trend === 0 ? ArrowRightIcon : trend > 0 ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div
      data-slot="stat-card"
      className={cn('bg-card text-card-foreground flex flex-col rounded-xl border p-5', className)}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight [font-stretch:112%]">{value}</p>
        {hasTrend && (
          <span
            className={cn(
              'tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
              trend > 0
                ? 'bg-success/12 text-success'
                : trend < 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <TrendIcon className="size-3" aria-hidden />
            {Math.abs(trend).toFixed(1)}%
            <span className="sr-only">{trend > 0 ? 'up' : trend < 0 ? 'down' : 'unchanged'}</span>
          </span>
        )}
      </div>
      {hint && <p className="text-muted-foreground mt-2 text-xs">{hint}</p>}
    </div>
  );
}
