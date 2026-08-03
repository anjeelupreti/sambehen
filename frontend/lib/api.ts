import 'server-only';

import { redirect } from 'next/navigation';
import { getAccessToken } from './session';
import type { ApiEnvelope, ApiErrorEnvelope, Paginated, ValidationDetail } from './types';

/**
 * Server-side API client.
 *
 * Every request carries the session's bearer token and every response is
 * unwrapped from the standard envelope, so callers deal in domain data
 * rather than transport shape.
 *
 * Two behaviours are worth knowing:
 *
 * 1. A 404 from a detail or mutation route may mean the row does not
 *    exist, OR that it belongs to another manager's chain. The backend
 *    deliberately makes those indistinguishable — a 403 would confirm the
 *    record exists. The UI must therefore say "not found", never "no
 *    access", or it leaks exactly what the API set out to hide.
 *
 * 2. `error.code` is the contract, not `message`. Branch on the code.
 *    Messages are for humans and may be reworded; codes are not.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ValidationDetail[] | Record<string, unknown> | null;
  readonly correlationId: string | null;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: ValidationDetail[] | Record<string, unknown> | null;
    correlationId?: string | null;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? null;
    this.correlationId = input.correlationId ?? null;
  }

  /** Field-level messages, when the failure was a 422. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};

    return Object.fromEntries(
      this.details.map((detail) => [detail.field, detail.message]),
    ) as Record<string, string>;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skips the bearer token, for the login and refresh routes. */
  anonymous?: boolean;
  /** Seconds to cache. Omit for no caching, which is the default. */
  revalidate?: number;
  /** Redirect to /login on a 401 rather than throwing. Defaults to true. */
  redirectOnUnauthorized?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_PREFIX}${path}`, API_URL);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      // Undefined and empty filters must not become "undefined" strings —
      // the backend validates query params strictly and would 422.
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** Issues a request and returns the whole envelope. */
export async function apiRequest<TData, TSummary = undefined>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<TData, TSummary>> {
  const {
    method = 'GET',
    body,
    query,
    anonymous = false,
    revalidate,
    redirectOnUnauthorized = true,
  } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!anonymous) {
    const token = await getAccessToken();
    if (!token) {
      if (redirectOnUnauthorized) redirect('/login');
      throw new ApiError({ status: 401, code: 'AUTH_UNAUTHENTICATED', message: 'Not signed in' });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: revalidate === undefined ? 'no-store' : undefined,
      next: revalidate === undefined ? undefined : { revalidate },
    });
  } catch (cause) {
    // A dead API is an operational failure, not a business one. Give it a
    // code of its own so the UI can say "cannot reach the API" instead of
    // rendering an empty list as though there were genuinely no rows.
    throw new ApiError({
      status: 503,
      code: 'API_UNREACHABLE',
      message: `Could not reach the API at ${API_URL}. Is it running?`,
      details: { cause: String(cause) },
    });
  }

  // Exports stream binary and are handled by fetchBlob, not here.
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = payload as ApiErrorEnvelope | null;

    if (response.status === 401 && redirectOnUnauthorized) {
      redirect('/login');
    }

    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code ?? 'UNKNOWN_ERROR',
      message: envelope?.error?.message ?? envelope?.message ?? response.statusText,
      details: envelope?.error?.details ?? null,
      correlationId: envelope?.correlationId ?? null,
    });
  }

  return payload as ApiEnvelope<TData, TSummary>;
}

/** Unwraps to `data` for callers that do not need meta or summary. */
export async function apiGet<TData>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<TData> {
  const envelope = await apiRequest<TData>(path, { ...options, method: 'GET' });
  return envelope.data;
}

/**
 * Fetches a list, keeping `meta` and `summary`.
 *
 * `summary` is always computed over the whole filtered set rather than the
 * current page, so it must be read from here and never recomputed by
 * reducing over `data`.
 */
export async function apiList<TRow, TSummary = undefined>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<Paginated<TRow, TSummary>> {
  const envelope = await apiRequest<TRow[], TSummary>(path, { ...options, method: 'GET' });

  return {
    data: envelope.data,
    meta: envelope.meta ?? {
      total: envelope.data.length,
      page: 1,
      limit: envelope.data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    summary: envelope.summary,
  };
}

export async function apiMutate<TData>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<TData> {
  const envelope = await apiRequest<TData>(path, { ...options, method, body });
  return envelope.data;
}
