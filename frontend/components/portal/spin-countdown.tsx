'use client';

/* eslint-disable @next/next/no-img-element -- small static artwork */
import { useEffect, useState } from 'react';

import type { components } from '@/lib/api-schema';
import { winAmount } from './night/format';

type MySpinEvent = components['schemas']['MySpinEventDto'];

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="grid h-12 w-12 place-items-center rounded-lg border border-gold/25 bg-[#0b1120] text-2xl font-bold text-gold tabular-nums shadow-[inset_0_-12px_16px_-12px_rgb(0_0_0/0.8)] [font-stretch:115%] sm:h-14 sm:w-14">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>
    </div>
  );
}

/** The next spin event the player is entered in, counting down to the draw. */
export function SpinCountdown({ event, art }: { event: MySpinEvent; art: string | null }) {
  const target = new Date(event.scheduledAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const live = event.status === 'live' || (now !== null && now >= target);
  const left = parts(target - (now ?? target));
  const prize = event.prizePool && Number(event.prizePool) > 0 ? winAmount(event.prizePool) : null;

  return (
    <section
      aria-labelledby="spin-title"
      className="relative overflow-hidden rounded-2xl border border-gold/25 bg-[radial-gradient(120%_90%_at_100%_0%,#2a2110_0%,transparent_55%),linear-gradient(160deg,#141f3c,#0f172b)] p-5"
    >
      {art && (
        <img
          src={art}
          alt=""
          className="pointer-events-none absolute -right-3 -bottom-3 size-28 opacity-95 sm:size-32"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
            {live ? 'Live now' : 'You’re in'}
          </span>
          <h2 id="spin-title" className="truncate text-base font-semibold">
            {event.name}
          </h2>
        </div>
        {(prize || event.prizeDescription) && (
          <p className="mt-2 pr-24 text-sm text-muted-foreground">
            {prize && (
              <span className="text-2xl font-bold text-foreground tabular-nums [font-stretch:115%]">
                {prize}
                <span className="text-muted-foreground ml-1.5 text-sm font-medium [font-stretch:100%]">
                  prize pool
                </span>
              </span>
            )}
            {!prize && event.prizeDescription}
          </p>
        )}
        {!live && now !== null && (
          <div className="mt-4 flex gap-2" role="timer" aria-label="Time until the draw">
            {left.days > 0 && <Tile value={left.days} label="Days" />}
            <Tile value={left.hours} label="Hrs" />
            <Tile value={left.minutes} label="Min" />
            {left.days === 0 && <Tile value={left.seconds} label="Sec" />}
          </div>
        )}
      </div>
    </section>
  );
}
