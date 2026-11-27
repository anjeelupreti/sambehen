'use client';

import { useEffect, useState } from 'react';

import { formatMoney } from '@/lib/money';

const KEY = 'howdi:last-balance';

/**
 * A money figure that counts from the last value this device saw to the
 * new one, so a change in balance is noticed. Unchanged, it just shows.
 */
export function AnimatedMoney({ value, className }: { value: string; className?: string }) {
  const target = Number(value);
  const [shown, setShown] = useState(target);

  useEffect(() => {
    let from = target;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) from = Number(saved);
      localStorage.setItem(KEY, String(target));
    } catch {
      // No storage: no animation.
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!Number.isFinite(from) || from === target || reduce) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setShown(from);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <span className={className}>
      <span aria-hidden>{formatMoney(shown.toFixed(2))}</span>
      <span className="sr-only">{formatMoney(value)}</span>
    </span>
  );
}
