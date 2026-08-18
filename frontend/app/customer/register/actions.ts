'use server';

import { ApiError, apiRequest } from '@/lib/api';

export interface CustomerRegisterState {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
}

/**
 * Creates a pending customer account.
 *
 * No session is issued — the API deliberately returns nothing to log
 * into, since a pending account cannot sign in until a master approves
 * it. Success here just means the request landed, shown as a "thanks,
 * we'll review it" message rather than a redirect.
 */
export async function registerCustomer(
  _previous: CustomerRegisterState,
  formData: FormData,
): Promise<CustomerRegisterState> {
  const email = String(formData.get('email') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = 'Enter your email address';
  if (!username) fieldErrors.username = 'Choose a username';
  if (!password) fieldErrors.password = 'Choose a password';
  else if (password.length < 8) fieldErrors.password = 'At least 8 characters';
  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors, success: false };
  }

  try {
    await apiRequest('/auth/customer/register', {
      method: 'POST',
      body: {
        email,
        username,
        password,
        ...(fullName ? { fullName } : {}),
        ...(phone ? { phone } : {}),
      },
      anonymous: true,
      redirectOnUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return { error: error.message, fieldErrors: {}, success: false };
      }
      if (error.status === 422) {
        return { error: null, fieldErrors: error.fieldErrors, success: false };
      }
      return { error: error.message, fieldErrors: {}, success: false };
    }
    throw error;
  }

  return { error: null, fieldErrors: {}, success: true };
}
