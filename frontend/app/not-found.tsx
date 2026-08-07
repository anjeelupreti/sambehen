import type { Metadata } from 'next';

import { NotFoundCard } from '@/components/not-found-card';

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
 *    instead skips `(app)`'s tree entirely, so this renders as the very
 *    first thing Next does for the request and the 404 status is real.
 *
 * No sidebar, since a role-forbidden request never reaches the layout that
 * would render one — showing it here would be reaching into a tree this
 * response deliberately never entered.
 */
export default function RootNotFound() {
  return <NotFoundCard backHref="/dashboard" />;
}
