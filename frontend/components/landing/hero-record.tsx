'use client';

import { useEffect, useState } from 'react';

import {
  HERO_LEDGER,
  HERO_NEW_ENTRY,
  HERO_PLAYER,
  HERO_THREAD,
  formatMoney,
  type LedgerEntry,
} from './landing-data';
import { cn } from '@/lib/utils';

/**
 * A player record as staff see it: ledger, VIP progress and the message
 * thread side by side.
 *
 * The page's one orchestrated moment happens here. Shortly after load a
 * store records a new transaction: the row lands at the top of the ledger,
 * and the balance, lifetime spend and VIP bar move with it — the same
 * thing the product does on every entry. With reduced motion the record
 * simply shows its updated state.
 */
export function HeroRecord() {
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setRecorded(true);
      return;
    }
    const timer = window.setTimeout(() => setRecorded(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  const added = recorded ? HERO_NEW_ENTRY.amount : 0;
  const lifetime = HERO_PLAYER.lifetimeIn + added;
  const balance = HERO_PLAYER.balance + added;
  const progress = Math.min(lifetime / HERO_PLAYER.vip.threshold, 1);
  const ledger: LedgerEntry[] = recorded ? [HERO_NEW_ENTRY, ...HERO_LEDGER] : HERO_LEDGER;

  return (
    <figure
      aria-label="Example player record in Sambehen"
      className="border-lp-line bg-lp-raised overflow-hidden rounded-2xl border shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]"
    >
      {/* Record header */}
      <div className="border-lp-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-lp-dim text-xs">Customers</p>
          <p className="truncate text-base font-semibold">{HERO_PLAYER.name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-lp-ok bg-lp-ok/10 rounded-md px-2 py-1 font-medium">Active</span>
          <span className="text-lp-dim">
            {HERO_PLAYER.store}, under {HERO_PLAYER.manager}
          </span>
        </div>
      </div>

      {/* Figures */}
      <dl className="border-lp-line grid grid-cols-3 border-b">
        <Figure label="Balance" value={formatMoney(balance)} changed={recorded} />
        <Figure label="This quarter" value={formatMoney(lifetime)} changed={recorded} />
        <Figure label="Last active" value={recorded ? 'Just now' : 'Today, 14:02'} />
      </dl>

      <div className="grid gap-px bg-lp-line md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Ledger */}
        <div className="bg-lp-raised min-w-0 p-5">
          <p className="text-lp-dim mb-3 text-xs">Transactions</p>
          <ul className="space-y-1" aria-live="polite">
            {ledger.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md px-2 py-1.5 text-sm',
                  entry.id === HERO_NEW_ENTRY.id &&
                    'bg-lp-signal/10 motion-safe:animate-[lp-land_600ms_cubic-bezier(0.2,0.8,0.2,1)]',
                )}
              >
                <span className="min-w-0 truncate">
                  {entry.game}
                  <span className="text-lp-dim ml-2 text-xs">{entry.when}</span>
                </span>
                <span
                  className={cn(
                    'tabular text-right font-medium',
                    entry.type === 'debit' ? 'text-lp-signal' : 'text-lp-text',
                  )}
                >
                  {entry.type === 'debit' ? '+' : '−'}
                  {formatMoney(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
          {recorded && (
            <p className="text-lp-dim mt-3 px-2 text-xs">Recorded by Store 11. VIP updated.</p>
          )}
        </div>

        {/* VIP + messages */}
        <div className="bg-lp-raised flex min-w-0 flex-col gap-5 p-5">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lp-dim text-xs">VIP, {HERO_PLAYER.vip.period.toLowerCase()}</p>
              <p className="text-lp-chip-text text-xs font-semibold">{HERO_PLAYER.vip.tier}</p>
            </div>
            <div
              className="bg-lp-sunk mt-2 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Progress to Gold"
              aria-valuemin={0}
              aria-valuemax={HERO_PLAYER.vip.threshold}
              aria-valuenow={lifetime}
            >
              <div
                className="bg-lp-chip h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="tabular mt-2 text-xs">
              {formatMoney(lifetime)}{' '}
              <span className="text-lp-dim">of {formatMoney(HERO_PLAYER.vip.threshold)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-lp-dim text-xs">Messages</p>
            {HERO_THREAD.map((message) => (
              <p
                key={message.text}
                className={cn(
                  'max-w-[92%] rounded-lg px-3 py-2 text-[13px] leading-snug',
                  message.from === 'team'
                    ? 'bg-lp-signal/15 ml-auto'
                    : 'bg-lp-sunk border-lp-line border',
                )}
              >
                {message.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function Figure({ label, value, changed }: { label: string; value: string; changed?: boolean }) {
  return (
    <div className="border-lp-line min-w-0 border-r px-5 py-4 last:border-r-0">
      <dt className="text-lp-dim truncate text-xs">{label}</dt>
      <dd
        className={cn(
          'tabular mt-1 truncate text-sm font-semibold sm:text-base',
          changed && 'motion-safe:animate-[lp-tick_700ms_ease-out]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
