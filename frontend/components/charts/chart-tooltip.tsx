'use client';

import { formatCount, formatMoney } from '@/lib/money';

export interface TooltipRow {
  key: string;
  label: string;
  /** The original money string, never a parsed number. */
  value: string;
  color: string;
}

/**
 * Shared tooltip surface for every chart on the site.
 *
 * Values are formatted from the money strings carried on each datum, not
 * from the numeric coordinate recharts used to place the mark. The swatch
 * carries series identity; the text stays in normal ink rather than taking
 * the series colour, which would fail contrast at small sizes.
 */
export function ChartTooltip({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: TooltipRow[];
  footer?: string;
}) {
  return (
    <div className="bg-popover text-popover-foreground min-w-44 rounded-lg border p-2.5 shadow-md">
      <p className="mb-1.5 text-xs font-medium">{title}</p>

      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-muted-foreground">{row.label}</span>
            </span>
            <span className="tabular font-medium">{formatMoney(row.value)}</span>
          </div>
        ))}
      </div>

      {footer ? (
        <p className="text-muted-foreground mt-1.5 border-t pt-1.5 text-xs">{footer}</p>
      ) : null}
    </div>
  );
}

export function tooltipCount(count: number, noun: string): string {
  return `${formatCount(count)} ${count === 1 ? noun : `${noun}s`}`;
}
