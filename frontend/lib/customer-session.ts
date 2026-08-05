import 'server-only';

import { cookies } from 'next/headers';

/**
 * Customer session storage.
 *
 * **Separate cookie names from staff, deliberately.** The API signs the two
 * realms with different secrets, so a customer token is rejected on every
 * team route and vice versa. Sharing one cookie namespace meant signing in
 * as a customer silently destroyed a staff session in the same browser —
 * the second login simply overwrote the first one's cookies, with no
 * indication anything had happened.
 *
 * With separate names the two sessions coexist: an operator can hold a
 * staff session and a customer session in one browser, which is exactly
 * what anyone testing this needs to do.
 */

const ACCESS_COOKIE = 'sambehen_customer_access';
const REFRESH_COOKIE = 'sambehen_customer_refresh';
const ACTOR_COOKIE = 'sambehen_customer_actor';

/** Non-secret display data, so the portal shell renders without an API call. */
export interface CustomerActor {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
}

const secureCookies = process.env.NODE_ENV === 'production';

export async function getCustomerAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getCustomerRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export async function getCustomerActor(): Promise<CustomerActor | null> {
  const store = await cookies();
  const raw = store.get(ACTOR_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CustomerActor;
  } catch {
    // A malformed cookie is treated as no session rather than a crash: the
    // customer gets a sign-in screen, which is recoverable.
    return null;
  }
}

/**
 * Reads the `exp` claim off an access token.
 *
 * Not a trust decision — the API verifies every request and this signature
 * is never checked. It only decides how long the cookie should live.
 */
function accessTokenLifetime(token: string): number {
  const FALLBACK = 15 * 60;

  try {
    const payload = token.split('.')[1];
    if (!payload) return FALLBACK;

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (typeof claims.exp !== 'number') return FALLBACK;

    const seconds = claims.exp - Math.floor(Date.now() / 1000);
    return seconds > 0 ? seconds : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function createCustomerSession(input: {
  accessToken: string;
  refreshToken: string;
  actor: CustomerActor;
}): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_COOKIE, input.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: accessTokenLifetime(input.accessToken),
  });

  store.set(REFRESH_COOKIE, input.refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  store.set(ACTOR_COOKIE, JSON.stringify(input.actor), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearCustomerSession(): Promise<void> {
  const store = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ACTOR_COOKIE]) {
    try {
      store.delete(name);
    } catch {
      // Next throws if cookies are modified during a Server Component render.
    }
  }
}
