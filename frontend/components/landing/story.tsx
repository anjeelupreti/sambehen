'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

import { Parallax } from './motion';
import {
  AccessScene,
  ChatScene,
  FriendsScene,
  ProgressScene,
  RecordScene,
  SceneArt,
  SignupScene,
  type SceneProps,
} from './story-scenes';
import { cn } from '@/lib/utils';

export type ChapterKey = 'arrives' | 'chat' | 'record' | 'progress' | 'friends' | 'operators';

interface Chapter {
  key: ChapterKey;
  title: string;
  body: string;
  points?: string[];
  Scene: ComponentType<SceneProps>;
}

const CHAPTERS: Chapter[] = [
  {
    key: 'arrives',
    title: 'A new face walks in',
    body: 'Savannah signs up on her phone. Before she can sign in, the master hands her to Store 11, and from then on she’s theirs to look after.',
    Scene: SignupScene,
  },
  {
    key: 'chat',
    title: 'Howdy, Savannah',
    body: 'Her first question goes straight to her store. Both sides see who’s online, who’s typing and what’s been read, so nothing waits in an inbox.',
    Scene: ChatScene,
  },
  {
    key: 'record',
    title: 'Every visit, on the record',
    body: 'Each time she plays, the store records it and her balance updates on the spot. She sees the same figure the store does.',
    Scene: RecordScene,
  },
  {
    key: 'progress',
    title: 'She keeps coming back',
    body: 'Her tiers fill in as she goes, and milestones mark the moments that matter: her first message, three months in, making VIP.',
    Scene: ProgressScene,
  },
  {
    key: 'friends',
    title: 'And brings her friends',
    body: 'She shares her invite link. When a friend joins and plays, both of them get their bonus, without anyone tallying it by hand.',
    Scene: FriendsScene,
  },
  {
    key: 'operators',
    title: 'Behind the counter',
    body: 'The master sees every store. Each manager sees their own, and each store sees only its players.',
    points: [
      'Every change is kept, with who made it and what it was before.',
      'Staff and players sign in separately and can never act as each other.',
      'Money is stored to the cent and never rounded.',
    ],
    Scene: AccessScene,
  },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Savannah's first months with a store, told in chapters. On wide screens
 * the text scrolls past a pinned stage and each chapter's scene plays as
 * you read; on phones each chapter carries its own scene and plays it once
 * when it comes into view.
 */
export function Story({ art }: { art: Record<ChapterKey, string> }) {
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const [progress, setProgress] = useState<number[]>(() => CHAPTERS.map(() => 1));
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.55;
      const rects = chapterRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
      // A chapter's scene plays across the first 70% of its trip past the
      // reading line, so it has finished by the time the text is centred.
      const next = rects.map((rect) => {
        if (!rect) return 1;
        const value = (line - rect.top) / (rect.height * 0.7);
        return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
      });
      setProgress((current) => (current.every((v, i) => v === next[i]) ? current : next));
      const containing = rects.findIndex((rect) => rect && rect.top <= line && rect.bottom > line);
      if (containing !== -1) setActive(containing);
      else if (rects[0] && rects[0].top > line) setActive(0);
      else setActive(CHAPTERS.length - 1);
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

  return (
    <div className="mx-auto grid w-full max-w-7xl px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <div>
        {CHAPTERS.map((chapter, index) => (
          <section
            key={chapter.key}
            id={chapter.key}
            ref={(el) => {
              chapterRefs.current[index] = el;
            }}
            aria-labelledby={`${chapter.key}-title`}
            className="flex scroll-mt-20 flex-col justify-center py-16 lg:min-h-[95svh] lg:py-24"
          >
            <p className="text-lp-primary tabular text-sm font-bold">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h2
              id={`${chapter.key}-title`}
              className="mt-3 text-3xl leading-[1.05] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-5xl"
            >
              {chapter.title}
            </h2>
            <p className="text-lp-dim mt-5 max-w-lg text-lg leading-relaxed">{chapter.body}</p>
            {chapter.points && (
              <ul className="mt-6 max-w-lg space-y-3">
                {chapter.points.map((point) => (
                  <li
                    key={point}
                    className="border-lp-line-strong border-l-2 pl-4 text-sm leading-relaxed"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-10 lg:hidden">
              <InlineScene chapter={chapter} art={art[chapter.key]} />
            </div>
          </section>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-20 flex h-[calc(100svh-5rem)] items-center justify-center">
          {CHAPTERS.map((chapter, index) => (
            <div
              key={chapter.key}
              aria-hidden={index !== active}
              className={cn(
                'absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out',
                index === active
                  ? 'translate-y-0 opacity-100'
                  : index < active
                    ? 'pointer-events-none -translate-y-8 opacity-0'
                    : 'pointer-events-none translate-y-8 opacity-0',
              )}
            >
              <Stage chapter={chapter} art={art[chapter.key]} progress={progress[index]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stage({ chapter, art, progress }: { chapter: Chapter; art: string; progress: number }) {
  const { Scene } = chapter;
  return (
    <div className="flex w-full justify-center px-8">
      <div className="relative origin-center xl:scale-110">
        <Parallax distance={40} tilt={4} className="absolute -top-24 -right-16 z-10 w-36 xl:w-44">
          <SceneArt src={art} />
        </Parallax>
        <Scene progress={progress} />
      </div>
    </div>
  );
}

/** A chapter's scene on a phone: plays through once when it is first seen. */
function InlineScene({ chapter, art }: { chapter: Chapter; art: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    setProgress(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 2600;
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
  }, []);

  const { Scene } = chapter;
  return (
    <div ref={ref} className="relative flex justify-center pt-16">
      <SceneArt src={art} className="absolute -top-2 right-0 z-10 w-28 sm:w-32" />
      <Scene progress={progress} />
    </div>
  );
}
