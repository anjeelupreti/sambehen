import 'server-only';

import { redirect } from 'next/navigation';

import { ApiError } from './api';
import { getCustomerAccessToken } from './customer-session';
import type { ApiEnvelope, ApiErrorEnvelope } from './types';

/**
 * Server-side API client for the **customer** realm.
 *
 * A separate client rather than a flag on the staff one, because the thing
 * that differs is which token is attached — and getting that wrong is
 * silent. A staff token on `/me/*` is rejected at signature verification,
 * not at a claim check, so the failure would look like a broken endpoint
 * rather than a wrong credential.
 *
 * A 401 here sends the customer to their own sign-in page, never the
 * staff one.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Redirect to the customer sign-in on a 401. Defaults to true. */
  redirectOnUnauthorized?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_PREFIX}${path}`, API_URL);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function customerRequest<TData>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<TData>> {
  const { method = 'GET', body, query, redirectOnUnauthorized = true } = options;

  const token = await getCustomerAccessToken();
  if (!token) {
    if (redirectOnUnauthorized) redirect('/customer/login');
    throw new ApiError({ status: 401, code: 'AUTH_UNAUTHENTICATED', message: 'Not signed in' });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (cause) {
    throw new ApiError({
      status: 503,
      code: 'API_UNREACHABLE',
      message: `Could not reach the API at ${API_URL}.`,
      details: { cause: String(cause) },
    });
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = payload as ApiErrorEnvelope | null;

    if (response.status === 401 && redirectOnUnauthorized) {
      redirect('/customer/login');
    }

    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code ?? 'UNKNOWN_ERROR',
      message: envelope?.error?.message ?? envelope?.message ?? response.statusText,
      details: envelope?.error?.details ?? null,
      correlationId: envelope?.correlationId ?? null,
    });
  }

  return payload as ApiEnvelope<TData>;
}

export async function customerGet<TData>(
  path: string,
  query?: RequestOptions['query'],
): Promise<TData> {
  const envelope = await customerRequest<TData>(path, { method: 'GET', query });
  return envelope.data;
}

export async function customerMutate<TData>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<TData> {
  const envelope = await customerRequest<TData>(path, { method, body });
  return envelope.data;
}
