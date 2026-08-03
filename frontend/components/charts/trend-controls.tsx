'use client';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Range and bucket-size controls for the trend chart.
 *
 * Both write to the URL, so a dashboard someone is looking at can be sent
 * to a colleague and arrive showing the same thing.
 *
 * Changing the range snaps the granularity to something readable: 365 daily
 * points is an unreadable smear, and one monthly point over a week is not a
 * trend. The user can still override afterwards.
 */
const RANGES = [
  { days: 30, label: '30d', granularity: 'day' },
  { days: 90, label: '90d', granularity: 'week' },
  { days: 365, label: '1y', granularity: 'month' },
] as const;

const GRANULARITIES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;

export function TrendControls() {
  const { get, setMany, setParam, pending } = useFilterParams();

  const days = get('lastNDays') ?? '30';
  const granularity = get('granularity') ?? 'day';

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="bg-muted flex rounded-md p-0.5" role="group" aria-label="Time range">
        {RANGES.map((range) => (
          <Button
            key={range.days}
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-pressed={days === String(range.days)}
            onClick={() =>
              setMany({ lastNDays: String(range.days), granularity: range.granularity })
            }
            className={cn(
              'h-7 px-2.5 text-xs',
              days === String(range.days) && 'bg-background shadow-xs',
            )}
          >
            {range.label}
          </Button>
        ))}
      </div>

      <div className="bg-muted flex rounded-md p-0.5" role="group" aria-label="Bucket size">
        {GRANULARITIES.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-pressed={granularity === option.value}
            onClick={() => setParam('granularity', option.value)}
            className={cn(
              'h-7 px-2.5 text-xs',
              granularity === option.value && 'bg-background shadow-xs',
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
