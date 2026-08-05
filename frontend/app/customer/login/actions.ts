'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { createSession, type SessionActor } from '@/lib/session';

/** Shape returned by the customer realm's login route. */
interface CustomerLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user?: { id?: string; username?: string; email?: string };
}

export interface CustomerLoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

export async function customerLogin(
  _previous: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!identifier || !password) {
    return {
      error: null,
      fieldErrors: {
        ...(identifier ? {} : { identifier: 'Enter your username or email' }),
        ...(password ? {} : { password: 'Enter your password' }),
      },
    };
  }

  let session: CustomerLoginResponse;

  try {
    const envelope = await apiRequest<CustomerLoginResponse>('/auth/customer/login', {
      method: 'POST',
      body: { identifier, password },
      anonymous: true,
      redirectOnUnauthorized: false,
    });
    session = envelope.data;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return { error: 'Those credentials were not recognised.', fieldErrors: {} };
      }
      if (error.status === 422) {
        return { error: null, fieldErrors: error.fieldErrors };
      }
      return { error: error.message, fieldErrors: {} };
    }
    throw error;
  }

  // Create session for the customer (though customer portal might not be fully built out yet)
  // We'll set a generic actor structure for customer
  await createSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    actor: {
      id: session.user?.id || 'customer-id',
      username: session.user?.username || identifier,
      // The session helper is typed for staff roles; the customer realm
      // has no role of its own. See the portal note in frontend/README.md.
      role: 'customer' as unknown as SessionActor['role'],
      email: session.user?.email || '',
    },
  });

  redirect('/dashboard');
}
