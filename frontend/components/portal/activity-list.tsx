/* eslint-disable @next/next/no-img-element -- small static artwork */
import { formatCount, formatDate, formatMoney } from '@/lib/money';

export interface MyTransaction {
  id: string;
  type: 'debit' | 'credit';
  amount: string;
  gameName: string | null;
  occurredAt: string;
  isCorrection: boolean;
}

const KIND = {
  debit: 'Money in',
  credit: 'Money out',
} as const;

/** The player's latest entries, newest first, as a list that reads on a phone. */
export function ActivityList({
  items,
  total,
  emptyArt,
}: {
  items: MyTransaction[];
  total: number;
  emptyArt?: string | null;
}) {
  return (
    <section aria-labelledby="activity-title" className="bg-card rounded-2xl border">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <h2 id="activity-title" className="text-base font-semibold">
          Recent activity
        </h2>
        {total > items.length && (
          <span className="text-muted-foreground text-xs">
            Latest {formatCount(items.length)} of {formatCount(total)}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          {emptyArt && <img src={emptyArt} alt="" className="mb-3 size-24" />}
          <p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.gameName ?? 'No game'}</p>
                <p className="text-muted-foreground text-xs">
                  {item.isCorrection ? 'Correction' : KIND[item.type]},{' '}
                  <time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold">
                {item.type === 'debit' ? '+' : '−'}
                {formatMoney(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
