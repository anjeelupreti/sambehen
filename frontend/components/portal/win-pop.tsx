'use client';

/* eslint-disable @next/next/no-img-element -- small static artwork */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { XIcon } from 'lucide-react';

import { useSocketEvent } from '@/components/chat/socket';
import { winAmount } from './night/format';
import type { FeedWin } from './night/use-live-wins';

const GAP_MS = 3 * 60_000;
const SHOW_MS = 6_000;

/**
 * A small card when someone's win is recorded while the player has the
 * app open. At most one every few minutes, and never over their chat.
 */
export function WinPop({ art }: { art: string | null }) {
  const pathname = usePathname();
  const [win, setWin] = useState<Omit<FeedWin, 'mine'> | null>(null);
  const lastShown = useRef(0);

  useSocketEvent<Omit<FeedWin, 'mine'>>('win:new', (next) => {
    if (pathname.startsWith('/customer/messages')) return;
    if (Date.now() - lastShown.current < GAP_MS) return;
    lastShown.current = Date.now();
    setWin(next);
  });

  useEffect(() => {
    if (!win) return;
    const timer = setTimeout(() => setWin(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [win]);

  if (!win) return null;

  return (
    <div
      role="status"
      className="animate-in fade-in-0 slide-in-from-bottom-3 fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 md:left-auto md:w-80"
    >
      <div className="bg-card relative flex items-center gap-3 rounded-2xl border border-gold/40 p-3 pr-10 shadow-lg shadow-black/40">
        {art && <img src={art} alt="" className="-my-3 size-16 shrink-0" />}
        <Link href="/customer/wins" className="min-w-0 flex-1" onClick={() => setWin(null)}>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{win.displayName}</span> just won
          </p>
          <p className="font-slab truncate text-xl text-gold">
            {winAmount(win.amount)}
            {win.gameName && (
              <span className="text-muted-foreground ml-1.5 font-lp text-sm font-medium">
                on {win.gameName}
              </span>
            )}
          </p>
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setWin(null)}
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2 grid size-7 place-items-center rounded-full"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
