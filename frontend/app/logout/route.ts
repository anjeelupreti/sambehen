import { NextResponse, type NextRequest } from 'next/server';

import { apiRequest } from '@/lib/api';

const COOKIES = ['sambehen_access', 'sambehen_refresh', 'sambehen_actor'];

/**
 * Ends the session.
 *
 * The cookies are cleared on the redirect response itself rather than
 * through `cookies()` followed by `redirect()`. `redirect()` works by
 * throwing, and the response the framework builds from that throw does not
 * reliably carry cookie mutations — which meant sign-out could land on
 * /login with the session still intact, and /login would send the user
 * straight back. Setting them here makes the Set-Cookie headers part of the
 * same response as the redirect, so there is nothing to lose.
 *
 * The API is told to revoke the refresh token first, but a failure there is
 * logged and ignored: the local session must end regardless, or nobody can
 * sign out of a broken backend.
 */
export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get('sambehen_refresh')?.value;

  if (refreshToken) {
    try {
      await apiRequest('/auth/team/logout', {
        method: 'POST',
        body: { refreshToken },
        anonymous: true,
        redirectOnUnauthorized: false,
      });
    } catch (error) {
      console.error('Failed to revoke the refresh token on sign out', error);
    }
  }

  const response = NextResponse.redirect(new URL('/login', request.url));
  for (const name of COOKIES) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }

  return response;
}
