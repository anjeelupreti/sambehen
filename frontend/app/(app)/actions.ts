'use server';

import { redirect } from 'next/navigation';

import { apiRequest } from '@/lib/api';
import { clearSession, getRefreshToken } from '@/lib/session';

/**
 * Signs out.
 *
 * Tells the API to revoke the refresh token before dropping the cookies,
 * so a stolen token cannot outlive the session. A failure there is logged
 * and ignored — the local session must still end, or the user is stuck
 * signed in on a broken API.
 */
export async function signOut(): Promise<void> {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await apiRequest('/auth/team/logout', {
        method: 'POST',
        body: { refreshToken },
        redirectOnUnauthorized: false,
      });
    } catch (error) {
      console.error('Failed to revoke the refresh token on sign out', error);
    }
  }

  await clearSession();
  redirect('/login');
}
