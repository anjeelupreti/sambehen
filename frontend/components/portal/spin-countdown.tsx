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
      <span className="font-slab relative grid h-14 w-13 place-items-center overflow-hidden rounded-md border border-white/10 bg-[#060a13] text-[1.7rem] leading-none text-gold before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-black/70 sm:h-16 sm:w-15 sm:text-3xl">
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
      className="bg-card relative overflow-hidden rounded-2xl border border-gold/30 p-5"
    >
      {art && (
        <img
          src={art}
          alt=""
          className="pointer-events-none absolute -right-2 -bottom-2 size-32 sm:size-36"
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
          <p className="text-muted-foreground mt-3 pr-28 text-sm">
            {prize && (
              <span className="font-slab text-foreground text-3xl">
                {prize}
                <span className="text-muted-foreground ml-1.5 font-lp text-sm font-medium">
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
