/* eslint-disable @next/next/no-img-element -- game art comes from staff-entered URLs */
import { cn } from '@/lib/utils';

const TONES = [
  'from-[#1d3a8f] to-[#0f1a3d]',
  'from-[#6b1f3a] to-[#2a0d1a]',
  'from-[#0f5a4a] to-[#06261f]',
  'from-[#5a3a0f] to-[#261806]',
  'from-[#3f1f7a] to-[#170b30]',
  'from-[#0f4a6b] to-[#061f2e]',
];

function tone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

/** A game's art, or a two-letter mark on a deep tone when there is none. */
export function GameMark({
  name,
  src,
  className,
}: {
  name: string | null;
  src?: string | null;
  className?: string;
}) {
  const label = name ?? 'Win';
  const letters = label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'font-slab relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm text-gold ring-1 ring-gold/25',
        tone(label),
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : letters}
    </span>
  );
}
