import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from 'lucide-react';

import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * The figure the dashboard leads with: net this month, its change on last
 * month, and the money in and out behind it. The only hero figure on the
 * page; everything else is a tile.
 */
export function MoneySummary({
  net,
  moneyIn,
  moneyOut,
  changePercent,
  allTimeNet,
}: {
  net: string;
  moneyIn: string;
  moneyOut: string;
  changePercent: number | null;
  allTimeNet: string;
}) {
  const TrendIcon =
    changePercent === null || changePercent === 0
      ? ArrowRightIcon
      : changePercent > 0
        ? ArrowUpIcon
        : ArrowDownIcon;

  return (
    <section
      aria-labelledby="net-title"
      className="bg-card flex flex-col justify-between gap-8 rounded-xl border p-6"
    >
      <div>
        <h2 id="net-title" className="text-muted-foreground text-sm font-normal">
          Net this month
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-5xl font-semibold tracking-tight [font-stretch:115%]">
            {formatMoney(net)}
          </p>
          {changePercent !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold',
                changePercent > 0
                  ? 'bg-success/12 text-success'
                  : changePercent < 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden />
              {Math.abs(changePercent).toFixed(1)}%
              <span className="text-muted-foreground font-normal">vs last month</span>
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Figure label="Money in" value={moneyIn} swatch="bg-debit" />
        <Figure label="Money out" value={moneyOut} swatch="bg-credit" />
        <Figure label="Net, all time" value={allTimeNet} />
      </dl>
    </section>
  );
}

function Figure({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
        {swatch && <span aria-hidden className={cn('size-2.5 rounded-[3px]', swatch)} />}
        {label}
      </dt>
      <dd className="mt-1 truncate text-xl font-semibold tracking-tight">{formatMoney(value)}</dd>
    </div>
  );
}
