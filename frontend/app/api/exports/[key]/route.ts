import { NextResponse, type NextRequest } from 'next/server';

import { getAccessToken } from '@/lib/session';

/**
 * Streams an export through this server.
 *
 * The browser cannot fetch an export directly. The bearer token lives in an
 * httpOnly cookie on *this* origin, so client JavaScript cannot read it to
 * build an Authorization header, and the cookie is not sent to the API's
 * origin either. The previous implementation did exactly that and every
 * export silently failed with a 401.
 *
 * So the browser asks this route, on its own origin, where the cookie is
 * sent automatically; the server attaches the token and pipes the bytes
 * back. The response is streamed rather than buffered — a 14-list export
 * of a large account has no business sitting in this server's memory.
 *
 * Exports are the one place the API returns binary rather than the JSON
 * envelope. Errors raised *before* the stream opens still come back as the
 * normal envelope, which is why a failure is read as JSON here.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Not signed in.' }, { status: 401 });
  }

  // The filters the user is looking at travel with the export, so the file
  // matches the list on screen rather than the whole table.
  const query = request.nextUrl.searchParams.toString();
  const target = `${API_URL}${API_PREFIX}/team/exports/${encodeURIComponent(key)}${query ? `?${query}` : ''}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Could not reach the API.' }, { status: 503 });
  }

  if (!upstream.ok) {
    // Still the JSON envelope at this point — the stream never opened.
    const payload = await upstream.json().catch(() => null);
    const message =
      (payload as { error?: { message?: string }; message?: string } | null)?.error?.message ??
      (payload as { message?: string } | null)?.message ??
      'Export failed.';

    return NextResponse.json({ message }, { status: upstream.status });
  }

  /*
   * Carry the upstream filename through rather than inventing one. The API
   * names the file after the list and the moment it was generated, which is
   * what makes two exports of the same list distinguishable on disk.
   */
  const disposition =
    upstream.headers.get('content-disposition') ?? `attachment; filename="${key}.xlsx"`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store',
    },
  });
}
