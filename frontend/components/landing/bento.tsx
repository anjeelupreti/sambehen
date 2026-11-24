'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import Image from 'next/image';

import {
  ChatScene,
  FriendsScene,
  ProgressScene,
  RecordScene,
  type SceneProps,
} from './story-scenes';
import { cn } from '@/lib/utils';

/**
 * Plays a scene from 0 to 1 once, the first time it is half in view.
 * Server render and reduced motion show the finished scene.
 */
function OnView({
  Scene,
  duration = 2600,
}: {
  Scene: ComponentType<SceneProps>;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setProgress(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        frame = requestAnimationFrame(function step(now) {
          const t = Math.min(1, (now - start) / duration);
          setProgress(Math.round(t * 100) / 100);
          if (t < 1) frame = requestAnimationFrame(step);
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [duration]);

  return (
    <div ref={ref} className="flex w-full justify-center">
      <Scene progress={progress} />
    </div>
  );
}

function Tile({
  title,
  body,
  children,
  className,
  art,
}: {
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
  art?: string;
}) {
  return (
    <article
      className={cn(
        'border-lp-line bg-lp-raised relative flex flex-col overflow-hidden rounded-3xl border',
        className,
      )}
    >
      <div className="relative z-10 p-7 sm:p-8">
        <h3 className="text-xl leading-tight font-extrabold [font-stretch:112%] sm:text-2xl">
          {title}
        </h3>
        <p className="text-lp-dim mt-2 max-w-md leading-relaxed">{body}</p>
      </div>
      {art && (
        <Image
          src={art}
          alt=""
          width={480}
          height={480}
          className="pointer-events-none absolute top-5 right-5 z-10 hidden w-24 select-none sm:block lg:w-28"
        />
      )}
      <div className="bg-lp-sunk mx-4 mb-4 flex flex-1 items-end justify-center overflow-hidden rounded-2xl px-4 pt-6 sm:mx-5 sm:mb-5 sm:px-6 sm:pt-8">
        <div className="w-full translate-y-3">{children}</div>
      </div>
    </article>
  );
}

/** What the product does, as four tiles that each show the real thing working. */
export function Bento() {
  return (
    <div className="grid gap-4 md:grid-cols-6 lg:gap-5">
      <Tile
        title="Live chat with every player"
        body="Online, typing and read, both ways. Nothing waits in an inbox."
        art="/brand/mascot/megaphone.webp"
        className="md:col-span-4"
      >
        <OnView Scene={ChatScene} duration={3400} />
      </Tile>
      <Tile
        title="Every visit, on the record"
        body="Balances update the moment a store records play."
        className="md:col-span-2"
      >
        <OnView Scene={RecordScene} />
      </Tile>
      <Tile
        title="Tiers and milestones"
        body="Players see their route to the next tier and the moments they’ve earned."
        className="md:col-span-3"
      >
        <OnView Scene={ProgressScene} />
      </Tile>
      <Tile
        title="Friends bring friends"
        body="Personal invite links, with bonuses posted once a friend plays."
        className="md:col-span-3"
      >
        <OnView Scene={FriendsScene} />
      </Tile>
    </div>
  );
}
