import { NextResponse } from 'next/server';

/**
 * A redirect to a path on this site, sent as a relative Location header.
 *
 * Route handlers can't build it from `request.url`: behind Railway's proxy
 * the standalone server sees its own bind address (localhost:8080), not the
 * public host, so `new URL(path, request.url)` sends people to localhost.
 * Browsers resolve a relative Location against the page they're on.
 */
export function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
