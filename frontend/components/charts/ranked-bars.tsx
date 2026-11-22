import { formatCount, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface RankedRow {
  key: string;
  label: string;
  /** Money as a decimal string, straight from the API. */
  value: string;
  count: number;
}

/**
 * Ranked horizontal bars, one hue, largest first. Every value is printed at
 * its bar's tip and the entry count beside the name, so nothing hides
 * behind hover and the bars need no separate table view.
 */
export function RankedBars({
  rows,
  barClassName,
  emptyText,
}: {
  rows: RankedRow[];
  /** The one series colour, e.g. bg-debit. */
  barClassName: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-sm">{emptyText}</p>;
  }

  const sorted = [...rows].sort((a, b) => Number(b.value) - Number(a.value));
  // Bar length is display-only geometry; totals stay strings everywhere else.
  const max = Math.max(...sorted.map((row) => Number(row.value)), 0);

  return (
    <ol className="space-y-4">
      {sorted.map((row) => {
        const share = max > 0 ? Math.max(Number(row.value) / max, 0) : 0;
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {row.label}
                <span className="text-muted-foreground ml-2 text-xs">
                  {formatCount(row.count)} {row.count === 1 ? 'entry' : 'entries'}
                </span>
              </span>
              <span className="tabular shrink-0 font-medium">{formatMoney(row.value)}</span>
            </div>
            <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', barClassName)}
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
