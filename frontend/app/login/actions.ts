'use server';

import { redirect } from 'next/navigation';

import { ApiError, apiRequest } from '@/lib/api';
import { createCustomerSession } from '@/lib/customer-session';
import { createSession } from '@/lib/session';
import type { UnifiedLoginResponse } from '@/lib/types';

export interface LoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Where to go after signing in. A `from` path is honoured only when it is a
 * local path inside the app the session belongs to; anything else falls
 * back to that app's home, so the parameter cannot become an open redirect
 * or send a customer into the staff app.
 */
function destination(realm: UnifiedLoginResponse['realm'], from: string): string {
  const local = from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\');
  const inCustomerApp = from === '/customer' || from.startsWith('/customer/');

  if (realm === 'customer') return local && inCustomerApp ? from : '/customer';
  return local && !inCustomerApp && from !== '/login' ? from : '/dashboard';
}

/**
 * One sign-in for staff and players. The API decides which kind of account
 * the credentials belong to; this stores the session in that realm's own
 * cookies and opens the matching app.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const from = String(formData.get('from') ?? '');

  if (!identifier || !password) {
    return {
      error: null,
      fieldErrors: {
        ...(identifier ? {} : { identifier: 'Enter your username or email' }),
        ...(password ? {} : { password: 'Enter your password' }),
      },
    };
  }

  let session: UnifiedLoginResponse;

  try {
    const envelope = await apiRequest<UnifiedLoginResponse>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
      anonymous: true,
      // A 401 here is a wrong password, not an expired session. Redirecting
      // to /login from /login would loop.
      redirectOnUnauthorized: false,
    });
    session = envelope.data;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // A pending or suspended account only gets this far with the right
    // password, so naming the reason reveals nothing to a guesser.
    if (error.code === 'AUTH_ACCOUNT_PENDING_APPROVAL') {
      return {
        error: 'Your account is waiting for approval. You can sign in once your store approves it.',
        fieldErrors: {},
      };
    }
    if (error.code === 'AUTH_ACCOUNT_DISABLED') {
      return {
        error: 'This account is not active. Contact your store or manager.',
        fieldErrors: {},
      };
    }
    if (error.status === 401) {
      // One message for a wrong username and a wrong password alike, so
      // the form never confirms which usernames exist.
      return { error: 'That username or password is not right.', fieldErrors: {} };
    }
    if (error.status === 429) {
      return { error: 'Too many attempts. Wait a minute, then try again.', fieldErrors: {} };
    }
    if (error.status === 422) {
      return { error: null, fieldErrors: error.fieldErrors };
    }
    return { error: error.message, fieldErrors: {} };
  }

  if (session.realm === 'team') {
    await createSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      actor: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
        email: session.user.email,
      },
    });
  } else {
    await createCustomerSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      actor: {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        fullName: session.user.fullName,
      },
    });
  }

  // Outside the try: redirect() throws a control-flow signal, and catching
  // it would swallow the navigation.
  redirect(destination(session.realm, from));
}
