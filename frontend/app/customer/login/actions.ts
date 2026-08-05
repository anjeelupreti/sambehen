'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { createCustomerSession } from '@/lib/customer-session';

/** Shape returned by the customer realm's login route. */
interface CustomerLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
  };
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

  /*
   * The customer's own cookie namespace, never the staff one.
   *
   * The two realms are signed with different secrets, so a customer token
   * is rejected on every team route. Writing it into the staff cookies —
   * which this used to do — dropped the customer on a dashboard where
   * nothing loaded, and silently destroyed any staff session in the same
   * browser.
   */
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

  // Outside the try: redirect() throws a control-flow signal.
  redirect('/customer');
}
