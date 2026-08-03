'use server';

import { redirect } from 'next/navigation';

import { ApiError, apiRequest } from '@/lib/api';
import { createSession } from '@/lib/session';
import type { TeamLoginResponse } from '@/lib/types';

export interface LoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Signs a staff member in.
 *
 * The token is exchanged on the server and stored in an httpOnly cookie,
 * so it never enters client JavaScript. The browser only ever receives a
 * cookie it cannot read.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
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

  let session: TeamLoginResponse;

  try {
    const envelope = await apiRequest<TeamLoginResponse>('/auth/team/login', {
      method: 'POST',
      body: { identifier, password },
      anonymous: true,
      // A 401 here is a wrong password, not an expired session. Redirecting
      // to /login from /login would loop.
      redirectOnUnauthorized: false,
    });
    session = envelope.data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Deliberately one message for both a bad username and a bad
      // password. Distinguishing them tells an attacker which usernames
      // exist, which is the same reasoning behind the API's 404-not-403.
      if (error.status === 401) {
        return { error: 'Those credentials were not recognised.', fieldErrors: {} };
      }

      if (error.status === 422) {
        return { error: null, fieldErrors: error.fieldErrors };
      }

      if (error.code === 'API_UNREACHABLE') {
        return { error: error.message, fieldErrors: {} };
      }

      return { error: error.message, fieldErrors: {} };
    }

    throw error;
  }

  await createSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    actor: {
      id: session.staff.id,
      username: session.staff.username,
      role: session.staff.role,
      email: session.staff.email,
    },
  });

  // Outside the try: redirect() throws a control-flow signal, and catching
  // it here would swallow the navigation.
  redirect('/dashboard');
}
