'use server';

import { ApiError, apiRequest } from '@/lib/api';

export interface ContactState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** Sends the demo request to the API, which emails it to the sales inbox. */
export async function requestDemo(_: ContactState, form: FormData): Promise<ContactState> {
  const value = (key: string) => String(form.get(key) ?? '').trim();
  const stores = value('stores');

  const fieldErrors: Record<string, string> = {};
  if (value('name').length < 2) fieldErrors.name = 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(value('email'))) fieldErrors.email = 'Enter a valid email address.';
  if (value('company').length < 2) fieldErrors.company = 'Enter your company’s name.';
  if (stores && !/^\d+$/.test(stores)) fieldErrors.stores = 'Enter a whole number.';
  if (Object.keys(fieldErrors).length) return { status: 'error', fieldErrors };

  try {
    await apiRequest('/contact', {
      method: 'POST',
      anonymous: true,
      redirectOnUnauthorized: false,
      body: {
        name: value('name'),
        email: value('email'),
        company: value('company'),
        ...(stores ? { stores: Number(stores) } : {}),
        message: value('message') || undefined,
        website: value('website') || undefined,
      },
    });
    return { status: 'sent' };
  } catch (error) {
    const tooMany = error instanceof ApiError && error.status === 429;
    return {
      status: 'error',
      message: tooMany
        ? 'Too many requests from here. Try again in a minute.'
        : 'Your request couldn’t be sent. Email us instead and we’ll pick it up.',
    };
  }
}
