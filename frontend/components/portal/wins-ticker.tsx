'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { winAmount } from './night/format';
import { useLiveWins, type FeedWin } from './night/use-live-wins';

function Item({ win }: { win: FeedWin }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-semibold text-foreground">{win.mine ? 'You' : win.displayName}</span>
      <span className="text-muted-foreground">won</span>
      <span className="font-bold text-gold tabular-nums">{winAmount(win.amount)}</span>
      {win.gameName && <span className="text-muted-foreground">on {win.gameName}</span>}
    </span>
  );
}

const Star = () => (
  <span aria-hidden className="text-gold/60 px-4 text-[10px]">
    ★
  </span>
);

/**
 * Recent big wins as a slow marquee under the header. Touch or hover
 * pauses it; with reduced motion it is a still row that scrolls by hand.
 */
export function WinsTicker({ initial, className }: { initial: FeedWin[]; className?: string }) {
  const wins = useLiveWins(initial);
  if (wins.length === 0) return null;

  const items = wins.slice(0, 15);
  // Two copies side by side; the track slides one copy's width, then repeats.
  const loop = [...items, ...items];

  return (
    <Link
      href="/customer/wins"
      aria-label={`Big wins: ${items
        .slice(0, 3)
        .map((win) => `${win.mine ? 'You' : win.displayName} won ${winAmount(win.amount)}`)
        .join(', ')}. See all wins.`}
      className={cn(
        'ticker focus-visible:ring-ring/70 flex h-10 items-center overflow-hidden border-y border-gold/20 bg-[#0c1222]/90 text-[13px] outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      <span className="relative z-10 flex h-full shrink-0 items-center gap-2 bg-[#0c1222] pr-3 pl-4 text-[11px] font-bold tracking-[0.14em] text-gold uppercase shadow-[12px_0_12px_-4px_#0c1222]">
        Big wins
      </span>
      <span
        className="ticker-track flex w-max items-center"
        style={{ '--ticker-duration': `${items.length * 6}s` } as React.CSSProperties}
        aria-hidden
      >
        {loop.map((win, index) => (
          <span key={`${win.id}-${index}`} className="flex items-center">
            <Item win={win} />
            <Star />
          </span>
        ))}
      </span>
    </Link>
  );
}
