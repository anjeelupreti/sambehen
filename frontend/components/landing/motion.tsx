'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

import { cn } from '@/lib/utils';

/*
 * Motion for the public landing page, and only there.
 *
 * Everything here is tied to scroll position: smooth scrolling and the
 * mascots' drift. Nothing loops and nothing fades in just for being on the
 * page. With reduced motion requested, none of it runs.
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
