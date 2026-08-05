import { redirect } from 'next/navigation';

import { getAccessToken } from '@/lib/session';

/**
 * Sends people to the right place.
 *
 * Keyed on the access token rather than the actor cookie, for the same
 * reason as /login: the actor cookie survives a week and would send someone
 * to a dashboard that cannot call the API. Middleware has already refreshed
 * by this point if a refresh was possible.
 */
export default async function RootPage() {
  redirect((await getAccessToken()) ? '/dashboard' : '/login');
}
