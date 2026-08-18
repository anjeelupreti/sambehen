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

/*
 * The customer realm.
 *
 * Its own cookies, because the API signs the two realms with different
 * secrets and one namespace meant a customer sign-in silently destroyed a
 * staff session in the same browser.
 */
const CUSTOMER_ACCESS_COOKIE = 'sambehen_customer_access';
const CUSTOMER_REFRESH_COOKIE = 'sambehen_customer_refresh';
const CUSTOMER_ACTOR_COOKIE = 'sambehen_customer_actor';

/*
 * Reachable without any session.
 *
 * `/unsubscribe` is here because it is reached from an email footer by
 * someone who has no session and cannot be asked to sign in — requiring
 * one would make the opt-out link useless, which is the opposite of what
 * an opt-out is for. `/r` is the same story for a referral link: whoever
 * clicks it has no account yet, which is the entire point.
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/logout',
  '/customer/login',
  '/customer/register',
  '/customer/logout',
  '/unsubscribe',
  '/r',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/*
 * Pages a store (or, for audit logs, anyone but a master) cannot open.
 * Matches the API's own role guard and what the sidebar already hides —
 * this is presentation catching up to the rule, not a new one.
 *
 * These three used to be `if (actor.role === 'store') notFound()` inside
 * each page. That check ran too late: `(app)/loading.tsx` wraps every page
 * under it in a Suspense boundary, so the loading shell — status 200 — had
 * already gone out by the time a page-level notFound() resolved, and the
 * status could not change after that. Checked here instead, before any of
 * that tree even starts rendering, the rewrite below lands on the *root*
 * not-found — outside `(app)` entirely — with a real 404.
 */
const ROLE_RESTRICTED: { prefix: string; allow: readonly string[] }[] = [
  { prefix: '/audit-logs', allow: ['master'] },
  { prefix: '/staff', allow: ['master', 'manager'] },
  { prefix: '/broadcast', allow: ['master', 'manager'] },
];

/** Parses just enough of the actor cookie to read a role, trusting nothing else in it. */
function actorRole(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

/** A cookie that fails to parse is treated as no role — restricted pages deny rather than guess. */
function roleForbidden(pathname: string, role: string | null): boolean {
  const restriction = ROLE_RESTRICTED.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  if (!restriction) return false;
  return role === null || !restriction.allow.includes(role);
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

/** The customer realm's own refresh route — a different secret entirely. */
async function refreshCustomer(refreshToken: string) {
  try {
    const response = await fetch(`${API_URL}${API_PREFIX}/auth/customer/refresh`, {
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
    return null;
  }
}

function applyCustomerTokens(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): NextResponse {
  response.cookies.set(CUSTOMER_ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });

  response.cookies.set(CUSTOMER_REFRESH_COOKIE, tokens.refreshToken, {
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

  // ── /customer/login, /customer/register ────────────────────────────────
  if (pathname === '/customer/login' || pathname === '/customer/register') {
    const customerAccess = request.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (customerAccess && !expiresSoon(customerAccess)) {
      return NextResponse.redirect(new URL('/customer', request.url));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  // ── The customer portal ────────────────────────────────────────────────
  //
  // Guarded against the *customer* cookies. A staff session must never open
  // these pages and a customer session must never open the staff app: the
  // API signs the realms with different secrets, so the wrong token is
  // rejected at signature verification and every request would fail.
  if (pathname === '/customer' || pathname.startsWith('/customer/')) {
    const customerAccess = request.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    const customerRefresh = request.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value;
    const customerActor = request.cookies.get(CUSTOMER_ACTOR_COOKIE)?.value;

    if (customerAccess && !expiresSoon(customerAccess) && customerActor) {
      return NextResponse.next();
    }

    if (customerRefresh && customerActor) {
      const tokens = await refreshCustomer(customerRefresh);
      if (tokens) return applyCustomerTokens(NextResponse.next(), tokens);
    }

    const response = NextResponse.redirect(new URL('/customer/login', request.url));
    for (const name of [CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE, CUSTOMER_ACTOR_COOKIE]) {
      response.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
    return response;
  }

  // ── Everything behind the staff session ────────────────────────────────
  //
  // The actor cookie is required as well as a token. The signed-in shell
  // renders from it, so a request carrying a valid token but no actor would
  // reach a layout that redirects to /login — which this middleware would
  // then bounce straight back, a second loop with a different cause. A
  // session missing any part of itself is treated as no session.
  //
  // A role-forbidden request is allowed through in the sense that it is not
  // sent to /login — it is signed in, just not for this page — but it is
  // rewritten to a path nothing serves, landing on the root not-found with
  // a genuine 404 rather than the staff page it asked for.
  const allowedResponse = () =>
    roleForbidden(pathname, actorRole(actor))
      ? NextResponse.rewrite(new URL('/__forbidden', request.url))
      : NextResponse.next();

  if (hasUsableAccess && actor) return allowedResponse();

  if (refreshToken && actor) {
    const tokens = await refresh(refreshToken);
    if (tokens) return applyTokens(allowedResponse(), tokens);
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
