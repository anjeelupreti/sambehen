'use client';

/* eslint-disable @next/next/no-img-element -- small static artwork */
import { useEffect, useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';

import { formatDate, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface VipCriterion {
  criteriaId: string;
  name: string;
  tier: number;
  achieved: string;
  threshold: string;
  percent: number;
  qualified: boolean;
  periodEnd?: string;
}

interface Tier {
  tier: number;
  name: string;
  reached: boolean;
  /** The criterion closest to completion, for "how much is left". */
  best: VipCriterion;
}

const SEEN_KEY = 'howdi:tier-celebrated';

/** "Gold — quarterly spend" -> "Gold". */
const tierName = (name: string) => name.split(/\s[—–-]\s/)[0].trim();

function toTiers(criteria: VipCriterion[]): Tier[] {
  const byTier = new Map<number, VipCriterion[]>();
  for (const c of criteria) byTier.set(c.tier, [...(byTier.get(c.tier) ?? []), c]);
  return [...byTier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, list]) => {
      const best = [...list].sort((a, b) => b.percent - a.percent)[0];
      return { tier, name: tierName(best.name), reached: list.some((c) => c.qualified), best };
    });
}

/**
 * VIP as a route: every tier is a stop, the ones reached are filled in, and
 * the next one says exactly what's left. Reaching a new tier is celebrated
 * once, on the first visit after it happens.
 */
export function TierJourney({
  criteria,
  trophyArt,
}: {
  criteria: VipCriterion[];
  trophyArt: string | null;
}) {
  const tiers = toTiers(criteria);
  const held = [...tiers].reverse().find((t) => t.reached) ?? null;
  const next = tiers.find((t) => !t.reached) ?? null;
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!held) return;
    try {
      const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
      if (held.tier > seen) setCelebrate(true);
    } catch {
      // Storage unavailable: skip the celebration rather than repeat it.
    }
  }, [held]);

  const dismiss = () => {
    setCelebrate(false);
    try {
      if (held) localStorage.setItem(SEEN_KEY, String(held.tier));
    } catch {
      // Nothing to do.
    }
  };

  return (
    <section aria-labelledby="vip-title" className="bg-card flex flex-col rounded-2xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="vip-title" className="text-base font-semibold">
          VIP
        </h2>
        {held && (
          <span className="bg-highlight text-highlight-foreground rounded-full px-2.5 py-0.5 text-xs font-bold">
            {held.name}
          </span>
        )}
      </div>

      {celebrate && held && (
        <div
          role="status"
          className="bg-highlight/25 border-highlight motion-safe:animate-in motion-safe:zoom-in-95 mt-4 flex items-center gap-3 rounded-xl border p-3"
        >
          {trophyArt && <img src={trophyArt} alt="" className="size-14 shrink-0" />}
          <p className="flex-1 text-sm font-bold">You reached {held.name}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="hover:bg-highlight/40 focus-visible:ring-ring/70 grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {tiers.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No VIP tiers are running right now.</p>
      ) : (
        <>
          <ol className="mt-6 flex items-start" aria-label="VIP tiers">
            {tiers.map((t, index) => {
              const isNext = t === next;
              return (
                <li key={t.tier} className="relative flex flex-1 flex-col items-center text-center">
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 rounded-full',
                        t.reached ? 'bg-highlight' : 'bg-muted',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold',
                      t.reached && 'bg-highlight text-highlight-foreground',
                      isNext && 'bg-card text-primary ring-primary ring-2',
                      !t.reached && !isNext && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t.reached ? <CheckIcon className="size-4" strokeWidth={3} /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'mt-2 text-xs',
                      t.reached || isNext ? 'font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    {t.name}
                    <span className="sr-only">
                      {t.reached ? ', reached' : isNext ? ', next' : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="bg-muted/60 mt-6 rounded-xl p-4">
            {next ? (
              <NextTier tier={next} />
            ) : (
              <p className="text-sm font-semibold">Top tier reached</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function NextTier({ tier }: { tier: Tier }) {
  const { best } = tier;
  const percent = Math.round(Math.min(best.percent, 100));
  const remaining = Math.max(Number(best.threshold) - Number(best.achieved), 0);
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">Next: {tier.name}</span>
        <span className="text-muted-foreground tabular text-xs">{percent}%</span>
      </div>
      <div
        className="bg-background mt-2 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${tier.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {formatMoney(String(remaining))} to go
        {best.periodEnd ? ` by ${formatDate(best.periodEnd)}` : ''}
      </p>
    </>
  );
}
