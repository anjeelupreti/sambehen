import { Coins, Dices, Gem, Spade, Ticket, Trophy } from 'lucide-react';

interface FloatingIcon {
  icon: typeof Dices;
  className: string;
  delay: string;
  rotate?: string;
}

const ICONS: FloatingIcon[] = [
  { icon: Dices, className: 'top-4 left-6 size-14 -rotate-6', delay: '0s', rotate: '-6deg' },
  { icon: Spade, className: 'top-2 right-10 size-11 rotate-12', delay: '1.1s', rotate: '12deg' },
  { icon: Coins, className: 'bottom-16 left-0 size-16 rotate-3', delay: '2s', rotate: '3deg' },
  { icon: Trophy, className: 'bottom-4 right-4 size-14 -rotate-3', delay: '0.6s', rotate: '-3deg' },
  {
    icon: Gem,
    className: 'top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rotate-6',
    delay: '1.6s',
    rotate: '6deg',
  },
  {
    icon: Ticket,
    className: 'bottom-1/3 right-0 size-12 -rotate-6',
    delay: '2.4s',
    rotate: '-6deg',
  },
];

/**
 * A decorative, no-real-assets hero visual: gradient blobs behind a
 * scattered ring of game icons, each bobbing on its own offset so the
 * cluster reads as alive rather than a static badge grid.
 *
 * Pure CSS — `--animate-float`/`--animate-blob` in globals.css — rather
 * than a new animation dependency for six moving shapes.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
      <div className="animate-blob absolute top-0 -left-4 size-72 rounded-full bg-primary/30 opacity-70 mix-blend-multiply blur-3xl dark:mix-blend-plus-lighter" />
      <div className="animate-blob absolute top-10 right-0 size-72 rounded-full bg-amber-400/30 opacity-70 mix-blend-multiply blur-3xl [animation-delay:2s] dark:mix-blend-plus-lighter" />
      <div className="animate-blob absolute -bottom-8 left-1/4 size-72 rounded-full bg-emerald-400/20 opacity-70 mix-blend-multiply blur-3xl [animation-delay:4s] dark:mix-blend-plus-lighter" />

      <div className="relative size-full">
        {ICONS.map(({ icon: Icon, className, delay, rotate }, index) => (
          <div
            key={index}
            style={{ '--float-rotate': rotate, animationDelay: delay } as React.CSSProperties}
            className={`animate-float bg-card text-primary absolute flex items-center justify-center rounded-2xl border p-3 shadow-lg ${className}`}
          >
            <Icon className="size-full" strokeWidth={1.5} />
          </div>
        ))}
      </div>
    </div>
  );
}
