import 'server-only';

import { cookies } from 'next/headers';
import type { Staff } from './types';

/**
 * Session storage.
 *
 * Tokens live in httpOnly cookies and are read only on the server. They are
 * never serialised into a Server Component's props, never placed in
 * localStorage, and never reach client JavaScript — so a script injected
 * into the page cannot read them.
 *
 * The consequence is that all API reads happen server-side. That is the
 * intended shape: the backend scopes every row to the actor, and the
 * server already holds the identity that scoping keys off.
 */

const ACCESS_COOKIE = 'sambehen_access';
const REFRESH_COOKIE = 'sambehen_refresh';
const ACTOR_COOKIE = 'sambehen_actor';

/** Non-secret display data, so the shell can render without an API call. */
export interface SessionActor {
  id: string;
  username: string;
  role: Staff['role'];
  email: string;
}

const secureCookies = process.env.NODE_ENV === 'production';

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export async function getActor(): Promise<SessionActor | null> {
  const store = await cookies();
  const raw = store.get(ACTOR_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionActor;
  } catch {
    // A malformed cookie is treated as no session rather than a crash:
    // the user gets a login screen, which is recoverable.
    return null;
  }
}

/**
 * Reads the `exp` claim off an access token.
 *
 * The API returns no lifetime with the token, so the cookie has to take it
 * from the token itself. This decodes the payload; it does NOT verify the
 * signature and must never be used to decide anything about trust — the API
 * verifies every request, and the only thing read here is when to stop
 * sending a token that will be rejected anyway.
 *
 * Falls back to 15 minutes if the claim is unreadable: a cookie that
 * expires too early costs a refresh, one that lives too long strands the
 * user on failing requests.
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

export async function createSession(input: {
  accessToken: string;
  refreshToken: string;
  actor: SessionActor;
}): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_COOKIE, input.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: accessTokenLifetime(input.accessToken),
  });

  // Outlives the access token deliberately — it exists to mint a new one.
  store.set(REFRESH_COOKIE, input.refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  // Readable by the server only, same as the rest. It holds no secret, but
  // there is no reason for client JS to have it either.
  store.set(ACTOR_COOKIE, JSON.stringify(input.actor), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ACTOR_COOKIE]) {
    try {
      store.delete(name);
    } catch {
      // Next.js throws if we modify cookies during Server Component rendering.
    }
  }
}
