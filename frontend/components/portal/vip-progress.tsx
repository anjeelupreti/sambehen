import { Badge } from '@/components/ui/badge';
import { formatCount, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface VipCriterion {
  criteriaId: string;
  name: string;
  tier: number;
  achieved: string;
  threshold: string;
  percent: number;
  qualified: boolean;
}

/** "Gold — quarterly spend" -> "Gold". */
const tierName = (name: string) => name.split(/\s[—–-]\s/)[0].trim();

/**
 * Progress against every active VIP tier: a name, a meter and the figures
 * per row. Reached tiers fill in sunflower; tiers still in reach fill in
 * the action colour and say how much is left.
 */
export function VipProgress({
  criteria,
  rewardsReceived,
}: {
  criteria: VipCriterion[];
  rewardsReceived: number;
}) {
  const sorted = [...criteria].sort((a, b) => b.tier - a.tier);
  const held = sorted.find((criterion) => criterion.qualified);

  return (
    <section aria-labelledby="vip-title" className="bg-card flex flex-col rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="vip-title" className="text-base font-semibold">
          VIP
        </h2>
        {held && <Badge variant="highlight">{tierName(held.name)}</Badge>}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No VIP tiers are running right now.</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {sorted.map((criterion) => {
            // Display-only: money strings become a remaining amount here.
            const remaining = Math.max(Number(criterion.threshold) - Number(criterion.achieved), 0);
            return (
              <li key={criterion.criteriaId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{tierName(criterion.name)}</span>
                  <span className="text-muted-foreground tabular text-xs">
                    {formatMoney(criterion.achieved)} of {formatMoney(criterion.threshold)}
                  </span>
                </div>
                <div
                  className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label={`${tierName(criterion.name)} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(criterion.percent, 100))}
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      criterion.qualified ? 'bg-highlight' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(criterion.percent, 100)}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {criterion.qualified ? 'Reached' : `${formatMoney(String(remaining))} to go`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground mt-auto border-t pt-4 text-sm">
        Rewards received{' '}
        <span className="text-foreground font-semibold">{formatCount(rewardsReceived)}</span>
      </p>
    </section>
  );
}
