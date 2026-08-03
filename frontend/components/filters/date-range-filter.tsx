'use client';

import { CalendarIcon } from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/lib/money';

/**
 * A from/to date filter over two query parameters.
 *
 * Native date inputs rather than a custom calendar: they are keyboard
 * accessible, localised by the browser, and on mobile open the platform
 * picker, which is a better experience than any drop-in replacement.
 *
 * Presets exist because "last 7 days" is the common case and computing it
 * by hand from two date fields is friction on every use.
 */
const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function DateRangeFilter({
  fromParam = 'dateFrom',
  toParam = 'dateTo',
  label = 'Date range',
}: {
  fromParam?: string;
  toParam?: string;
  label?: string;
}) {
  const { get, setMany } = useFilterParams();
  const from = get(fromParam);
  const to = get(toParam);
  const active = Boolean(from || to);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setMany({ [fromParam]: isoDate(start), [toParam]: isoDate(end) });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={active ? 'secondary' : 'outline'} size="sm" className="gap-2">
          <CalendarIcon className="size-4" />
          {active ? (
            <span className="tabular">
              {from ? formatDate(from) : '…'} – {to ? formatDate(to) : '…'}
            </span>
          ) : (
            label
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={fromParam} className="text-xs">
              From
            </Label>
            <Input
              id={fromParam}
              type="date"
              value={from ?? ''}
              max={to}
              onChange={(event) => setMany({ [fromParam]: event.target.value || undefined })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={toParam} className="text-xs">
              To
            </Label>
            <Input
              id={toParam}
              type="date"
              value={to ?? ''}
              min={from}
              onChange={(event) => setMany({ [toParam]: event.target.value || undefined })}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {active ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setMany({ [fromParam]: undefined, [toParam]: undefined })}
          >
            Clear dates
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
