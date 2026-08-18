'use client';

import { Coins, Crown, Dices, Gem, Sparkles, Ticket, Trophy, Zap } from 'lucide-react';

const SEGMENTS = [Trophy, Coins, Gem, Ticket, Crown, Sparkles, Dices, Zap];

/**
 * A decorative spin wheel: idles in a slow continuous rotation, speeds up
 * on hover. Purely illustrative of the real spin-event feature — no odds
 * or prize claims are implied, since those vary per event and are not
 * something a marketing page should promise.
 */
export function SpinWheel() {
  return (
    <div className="group relative mx-auto aspect-square w-full max-w-xs">
      <div
        className="border-primary/20 [animation:spin_16s_linear_infinite] group-hover:[animation-duration:2.5s] relative size-full rounded-full border-8 shadow-xl transition-[animation-duration] duration-300"
        style={{
          background:
            'conic-gradient(var(--primary) 0deg 45deg, var(--card) 45deg 90deg, var(--primary) 90deg 135deg, var(--card) 135deg 180deg, var(--primary) 180deg 225deg, var(--card) 225deg 270deg, var(--primary) 270deg 315deg, var(--card) 315deg 360deg)',
        }}
      >
        {SEGMENTS.map((Icon, index) => {
          const angle = (360 / SEGMENTS.length) * index;
          return (
            <div
              key={index}
              className="absolute top-1/2 left-1/2 size-full"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <Icon
                className={`absolute top-3 left-1/2 size-5 -translate-x-1/2 ${index % 2 === 0 ? 'text-primary-foreground' : 'text-primary'}`}
              />
            </div>
          );
        })}
      </div>

      <div className="bg-background absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 shadow-lg">
        <Sparkles className="text-primary size-6" />
      </div>

      {/* Pointer */}
      <div className="border-t-primary absolute -top-2 left-1/2 size-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent" />
    </div>
  );
}
