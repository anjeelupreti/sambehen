import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { primaryButton, secondaryButton, SiteShell } from '@/components/landing/site-shell';
import { publicAsset } from '@/lib/public-asset';

export const metadata: Metadata = { title: 'Not found' };

/**
 * The root boundary — reached two ways:
 *
 * 1. A URL that matches nothing anywhere (the ordinary case this file
 *    exists for).
 * 2. Middleware rewriting a role-forbidden request to a made-up path that
 *    matches nothing under `(app)`, on purpose. `(app)/loading.tsx` wraps
 *    every page there in Suspense, so a `notFound()` thrown from *inside*
 *    that tree ships the loading shell — status 200 — before the check
 *    even runs; the real status can't change after that. Landing here
 *    instead skips `(app)`'s tree entirely, so the 404 status is real.
 *
 * The wording must not become "you do not have access": telling a missing
 * page from a forbidden one would confirm the page exists. "Home" works
 * for everyone, since the home page sends signed-in people to their app.
 */
export default function RootNotFound() {
  // The lost rider, once its art is in public/brand/mascot; until then, the resting one.
  const lost = publicAsset('brand/mascot/lost.webp');

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <Image
          src={lost ?? '/brand/mascot/resting.webp'}
          alt=""
          width={lost ? 720 : 480}
          height={lost ? 540 : 480}
          priority
          className={lost ? 'w-72 select-none sm:w-96' : 'w-40 select-none'}
        />
        <p className="text-lp-dim mt-6 text-sm font-semibold tracking-[0.18em] uppercase">404</p>
        <h1 className="mt-2 text-4xl font-extrabold [font-stretch:118%] sm:text-5xl">
          This trail goes nowhere
        </h1>
        <p className="text-lp-dim mt-4 text-lg">
          The page you’re after doesn’t exist, or it isn’t one of yours.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={primaryButton}>
            Go home
          </Link>
          <Link href="/contact" className={secondaryButton}>
            Contact us
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
