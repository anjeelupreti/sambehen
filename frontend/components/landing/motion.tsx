'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

import { cn } from '@/lib/utils';

/*
 * Motion for the public landing page, and only there.
 *
 * Everything here is either tied to scroll position (smooth scrolling,
 * parallax, the lifecycle line) or plays once when something first comes
 * into view (a chart drawing in, a number counting up). Nothing loops and
 * nothing fades in just for being on the page. With reduced motion
 * requested, none of it runs and every element renders in its final state.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Smooth scrolling for the page, and the `lp-motion` switch the CSS keys
 * its "before" states off. Without JavaScript, or with reduced motion,
 * that class never appears and nothing starts hidden.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = document.documentElement;
    root.classList.add('lp-motion');

    const lenis = new Lenis({ autoRaf: true, lerp: 0.12, anchors: true });

    return () => {
      lenis.destroy();
      root.classList.remove('lp-motion');
    };
  }, []);
  return null;
}

/** Calls back with `el`'s position through the viewport: 0 entering at the bottom, 1 leaving at the top. */
function useScrollProgress<T extends HTMLElement>(onProgress: (progress: number, el: T) => void) {
  const ref = useRef<T>(null);
  const callback = useRef(onProgress);
  callback.current = onProgress;

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = (vh - rect.top) / (vh + rect.height);
      callback.current(Math.min(1, Math.max(0, progress)), el);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return ref;
}

/**
 * Drifts its child against the scroll: `distance` pixels across the
 * element's trip through the viewport, with a slight tilt. Used on the
 * mascot art so the characters feel placed in the page, not pasted on.
 */
export function Parallax({
  children,
  distance = 60,
  tilt = 4,
  className,
}: {
  children: ReactNode;
  distance?: number;
  tilt?: number;
  className?: string;
}) {
  const ref = useScrollProgress<HTMLDivElement>((progress, el) => {
    const centred = progress - 0.5;
    el.style.transform = `translate3d(0, ${(-centred * distance).toFixed(1)}px, 0) rotate(${(centred * tilt).toFixed(2)}deg)`;
  });
  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  );
}

/** True once the element has been at least `threshold` visible. Never goes back. */
function useSeen<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/**
 * Marks its subtree `data-seen` the first time it scrolls into view. CSS
 * classes inside (`lp-grow-y`, `lp-grow-x`, `lp-pop`) play from there.
 */
export function Seen({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} data-seen={seen ? '' : undefined} className={className}>
      {children}
    </div>
  );
}

/** A figure that counts up from zero the first time it is seen. Renders the real value without JS. */
const FORMATS = {
  dollars: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }),
  count: new Intl.NumberFormat('en-US'),
};

export function CountUp({ value, format }: { value: number; format: keyof typeof FORMATS }) {
  const [ref, seen] = useSeen<HTMLSpanElement>(0.6);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reducedMotion()) return;
    if (!seen) {
      setShown(0);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [seen, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {FORMATS[format].format(Math.round(shown))}
    </span>
  );
}

/**
 * The sign-up-to-reward steps, lit in order as the section scrolls past:
 * a line fills across the top and each step turns on as the line reaches it.
 */
export function LifecycleSteps({ steps }: { steps: { title: string; body: string }[] }) {
  const [lit, setLit] = useState(steps.length);
  const fill = useRef<HTMLSpanElement>(null);
  const ref = useScrollProgress<HTMLDivElement>((progress) => {
    // Most of the travel happens while the section is in the middle of the screen.
    const local = Math.min(1, Math.max(0, (progress - 0.2) / 0.45));
    if (fill.current) fill.current.style.transform = `scaleX(${local})`;
    setLit(Math.round(local * steps.length));
  });

  return (
    <div ref={ref} className="mt-12">
      <div aria-hidden className="bg-lp-line mb-6 h-1 overflow-hidden rounded-full">
        <span
          ref={fill}
          className="bg-lp-primary block h-full origin-left rounded-full"
          style={{ transform: 'scaleX(1)' }}
        />
      </div>
      <ol className="border-lp-line bg-lp-line grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => {
          const on = index < lit;
          return (
            <li
              key={step.title}
              className={cn(
                'bg-lp-raised flex flex-col gap-3 p-6 transition-colors duration-500',
                on && 'bg-lp-raised',
              )}
            >
              <span
                className={cn(
                  'tabular grid size-9 place-items-center rounded-full text-sm font-bold transition-colors duration-500',
                  on ? 'bg-lp-primary text-white' : 'bg-lp-sunk text-lp-dim',
                )}
              >
                {index + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-lp-dim text-sm leading-relaxed">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
