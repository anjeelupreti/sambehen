import { NextResponse, type NextRequest } from 'next/server';

const COOKIES = [
  'sambehen_customer_access',
  'sambehen_customer_refresh',
  'sambehen_customer_actor',
];

/**
 * Ends the customer session.
 *
 * Clears only the customer cookies, so signing out of the portal leaves a
 * staff session in the same browser untouched — the whole point of the
 * separate namespace.
 *
 * Cookies are set on the redirect response itself: `redirect()` works by
 * throwing, and the response built from that throw does not reliably carry
 * cookie mutations.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/customer/login', request.url));
  for (const name of COOKIES) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
