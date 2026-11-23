'use client';

import { useEffect, useState } from 'react';
import { CheckCheckIcon, CheckIcon, PaperclipIcon, SendHorizontalIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Line {
  from: 'player' | 'staff';
  body: string;
  time: string;
}

const LINES: Line[] = [
  { from: 'player', body: 'Howdy! Did my Friday top-up go through?', time: '6:10 PM' },
  { from: 'staff', body: 'It did. $250 posted at 6:12 PM, balance is $1,360.50.', time: '6:12 PM' },
  { from: 'player', body: 'Perfect, thanks y’all', time: '6:12 PM' },
];

/*
 * The conversation plays out in steps: a message lands, the other side reads
 * it, starts typing, replies. Each step is a frame of state, not a CSS
 * animation, so reduced-motion visitors simply get the last frame.
 */
type Frame = { shown: number; read: number; typing: Line['from'] | null };
const FRAMES: { frame: Frame; ms: number }[] = [
  { frame: { shown: 0, read: 0, typing: 'player' }, ms: 1400 },
  { frame: { shown: 1, read: 0, typing: null }, ms: 1300 },
  { frame: { shown: 1, read: 1, typing: null }, ms: 700 },
  { frame: { shown: 1, read: 1, typing: 'staff' }, ms: 2000 },
  { frame: { shown: 2, read: 1, typing: null }, ms: 1300 },
  { frame: { shown: 2, read: 2, typing: null }, ms: 700 },
  { frame: { shown: 2, read: 2, typing: 'player' }, ms: 1400 },
  { frame: { shown: 3, read: 2, typing: null }, ms: 1000 },
  { frame: { shown: 3, read: 3, typing: null }, ms: 5000 },
];
const LAST = FRAMES[FRAMES.length - 1].frame;

/** A staff member's view of one live player conversation, on loop. */
export function ChatDemo() {
  const [step, setStep] = useState(FRAMES.length - 1);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      setStep(index);
      timer = setTimeout(() => {
        index = (index + 1) % FRAMES.length;
        run();
      }, FRAMES[index].ms);
    };
    run();
    return () => clearTimeout(timer);
  }, []);

  const { shown, read, typing } = FRAMES[step]?.frame ?? LAST;

  return (
    <div
      className="border-lp-line bg-lp-raised overflow-hidden rounded-2xl border shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]"
      aria-label="Example conversation between a store and a player"
      role="img"
    >
      <div className="border-lp-line flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-lp-primary/12 relative grid size-10 place-items-center rounded-full text-sm font-semibold">
          SP
          <span className="bg-lp-ok ring-lp-raised absolute right-0 bottom-0 size-2.5 rounded-full ring-2" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">Savannah Pruitt</p>
          <p className="text-lp-ok text-xs">{typing === 'player' ? 'typing…' : 'Online'}</p>
        </div>
        <span className="text-lp-dim text-xs">Store 11</span>
      </div>

      <div className="bg-lp-sunk flex h-[16.5rem] flex-col justify-end gap-2 px-4 py-4">
        <p className="bg-lp-raised text-lp-dim mx-auto mb-1 rounded-full px-3 py-0.5 text-[11px] font-medium">
          Today
        </p>
        {LINES.slice(0, shown).map((line, index) => {
          const mine = line.from === 'staff';
          return (
            <div
              key={index}
              className={cn(
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 flex max-w-[85%] items-end gap-2 rounded-2xl px-3.5 py-2 text-[15px] leading-snug',
                mine
                  ? 'bg-lp-primary self-end rounded-br-md text-white'
                  : 'bg-lp-raised border-lp-line self-start rounded-bl-md border',
              )}
            >
              <span>{line.body}</span>
              <span
                className={cn(
                  'flex shrink-0 translate-y-0.5 items-center gap-1 text-[11px]',
                  mine ? 'text-white' : 'text-lp-dim',
                )}
              >
                {line.time}
                {mine &&
                  (read > index ? (
                    <CheckCheckIcon className="size-3.5" aria-hidden />
                  ) : (
                    <CheckIcon className="size-3.5" aria-hidden />
                  ))}
              </span>
            </div>
          );
        })}
        {typing === 'staff' && (
          <span className="bg-lp-primary/85 flex w-fit gap-1 self-end rounded-2xl rounded-br-md px-3.5 py-3">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 animate-bounce rounded-full bg-white"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="border-lp-line flex items-center gap-2 border-t px-3 py-2.5">
        <PaperclipIcon className="text-lp-dim size-5 shrink-0" aria-hidden />
        <span className="border-lp-line text-lp-dim flex-1 rounded-full border px-4 py-2 text-sm">
          Message
        </span>
        <span className="bg-lp-primary grid size-10 shrink-0 place-items-center rounded-full text-white">
          <SendHorizontalIcon className="size-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}
