import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session continuity, and the one place that can end a redirect loop.
 *
 * The three session cookies do not expire together. The access token lives
 * about fifteen minutes; the refresh token and the actor record live a week.
 * Without something in the middle, the fifteen-minute mark produced this:
 *
 *   /dashboard  actor cookie present, so the shell renders
 *               → page calls the API, no access token → redirect to sign out
 *   /login      actor cookie still present → redirect to /dashboard
 *   /dashboard  … and round again, several times a second
 *
 * The refresh token existed the whole time and nothing used it. So this runs
 * before any page does: if the access token is gone and a refresh token is
 * present, it mints a new pair and lets the request continue. The user stays
 * signed in for a week of activity instead of fifteen minutes.
 *
 * Middleware is the only place this can happen. A Server Component cannot
 * set a cookie during render, so it could never persist a refreshed token —
 * it could only notice the problem and redirect, which is what produced the
 * loop. Here the new cookies ride out on the response.
 *
 * Every exit path either sets a usable session or clears it completely.
 * Nothing leaves a half-session behind, because a half-session is exactly
 * what the loop was made of.
 */

const ACCESS_COOKIE = 'sambehen_access';
const REFRESH_COOKIE = 'sambehen_refresh';
const ACTOR_COOKIE = 'sambehen_actor';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

const secureCookies = process.env.NODE_ENV === 'production';

/** Reachable without a session. */
const PUBLIC_PATHS = ['/login', '/logout', '/customer'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Drops every session cookie on the response that is about to be sent. */
function clearSession(response: NextResponse): NextResponse {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ACTOR_COOKIE]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}

/**
 * Reads the `exp` claim off a token.
 *
 * Not a trust decision — the API verifies every request and this signature
 * is never checked here. It only answers "is this worth sending?", so an
 * unreadable token is treated as expired and refreshed rather than trusted.
 */
function expiresSoon(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;

    const claims = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number };
    if (typeof claims.exp !== 'number') return true;

    // Refreshed a little early so a request cannot expire in flight.
    return claims.exp - 30 <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

async function refresh(refreshToken: string) {
  try {
    const response = await fetch(`${API_URL}${API_PREFIX}/auth/team/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: { accessToken?: string; refreshToken?: string };
    };

    const accessToken = payload.data?.accessToken;
    const nextRefreshToken = payload.data?.refreshToken;
    if (!accessToken || !nextRefreshToken) return null;

    return { accessToken, refreshToken: nextRefreshToken };
  } catch {
    // A dead API is not a bad session. Returning null signs the user out
    // rather than looping, and they can sign in again once it is back.
    return null;
  }
}

function applyTokens(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): NextResponse {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });

  // Rotated on every refresh, so the stored one must be replaced or the
  // next refresh presents a token the API has already retired.
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const actor = request.cookies.get(ACTOR_COOKIE)?.value;

  const hasUsableAccess = Boolean(accessToken) && !expiresSoon(accessToken!);

  // ── /login ─────────────────────────────────────────────────────────────
  // Only a usable access token sends someone away from the sign-in page.
  // Bouncing on the actor cookie alone was the second half of the loop:
  // that cookie outlives the access token by a week.
  if (pathname === '/login') {
    if (hasUsableAccess) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (refreshToken) {
      const tokens = await refresh(refreshToken);
      if (tokens) {
        return applyTokens(NextResponse.redirect(new URL('/dashboard', request.url)), tokens);
      }
      // The refresh token is spent. Clear everything so the form renders
      // instead of being redirected away by a stale actor cookie.
      return clearSession(NextResponse.next());
    }

    return actor ? clearSession(NextResponse.next()) : NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  // ── Everything behind the session ──────────────────────────────────────
  //
  // The actor cookie is required as well as a token. The signed-in shell
  // renders from it, so a request carrying a valid token but no actor would
  // reach a layout that redirects to /login — which this middleware would
  // then bounce straight back, a second loop with a different cause. A
  // session missing any part of itself is treated as no session.
  if (hasUsableAccess && actor) return NextResponse.next();

  if (refreshToken && actor) {
    const tokens = await refresh(refreshToken);
    if (tokens) return applyTokens(NextResponse.next(), tokens);
  }

  // No way to get a working token. Send them to sign in with the session
  // wiped, so /login has nothing stale to bounce off.
  const target = new URL('/login', request.url);
  if (pathname !== '/' && pathname !== '/dashboard') {
    target.searchParams.set('from', `${pathname}${search}`);
  }

  return clearSession(NextResponse.redirect(target));
}

export const config = {
  /*
   * Everything except Next's own assets and static files. The matcher is
   * deliberately broad: a page that skips this check is a page that can
   * rediscover the loop.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
