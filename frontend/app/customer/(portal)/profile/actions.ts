'use server';

import { revalidatePath } from 'next/cache';

import { ApiError } from '@/lib/api';
import { customerMutate } from '@/lib/customer-api';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** Saves the fields a player may change about themselves. */
export async function updateMyProfile(
  _: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const value = (key: string) => String(form.get(key) ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (value('fullName').length < 2) fieldErrors.fullName = 'Enter your name.';
  if (value('phone') && !/^[+()\d\s.-]{7,32}$/.test(value('phone'))) {
    fieldErrors.phone = 'Enter a phone number, or leave it empty.';
  }
  if (Object.keys(fieldErrors).length) return { status: 'error', fieldErrors };

  try {
    await customerMutate('/me/profile', 'PATCH', {
      fullName: value('fullName'),
      phone: value('phone'),
      city: value('city'),
      state: value('state'),
      country: value('country'),
    });
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError && error.status === 422
          ? 'Check the highlighted fields.'
          : 'Your changes couldn’t be saved. Try again.',
    };
  }

  revalidatePath('/customer', 'layout');
  return { status: 'saved' };
}
