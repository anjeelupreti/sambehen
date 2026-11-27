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
      <span className="font-slab text-gold">{winAmount(win.amount)}</span>
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
        'ticker marquee-bulbs focus-visible:ring-ring/70 flex h-11 items-center overflow-hidden bg-[#060a13] text-[13px] outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      <span className="font-slab relative z-10 flex h-[calc(100%-12px)] shrink-0 items-center bg-[#060a13] pr-3 pl-4 text-[13px] tracking-wide text-gold uppercase">
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
