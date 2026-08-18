'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import { getActor } from '@/lib/session';
import type { ActionResult } from '@/lib/action-result';
import type { Staff } from '@/lib/types';

/**
 * Staff mutations.
 *
 * A manager may act on their own stores and nobody else's; the API
 * enforces that and returns 404 rather than 403 for a staff member outside
 * the caller's chain, so these actions never need to check the chain
 * themselves.
 */
export async function setStaffActive(id: string, active: boolean): Promise<ActionResult<Staff>> {
  const result = await runAction(
    () => apiMutate<Staff>(`/team/staff/${id}/${active ? 'activate' : 'deactivate'}`, 'PATCH'),
    active ? 'Staff member reactivated.' : 'Staff member deactivated.',
  );

  if (result.ok) revalidatePath('/staff');
  return result;
}

export interface NewStaffInput {
  email: string;
  username: string;
  password: string;
  role: 'manager' | 'store';
  parentId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Creates a staff member.
 *
 * Only two roles can be created: a master makes managers or stores, a
 * manager makes stores under themselves. There is no second master — the
 * API rejects it, and offering it here would produce a confusing 422.
 *
 * `parentId` is omitted when a manager creates a store: the API places the
 * store under the caller, which is the only placement a manager could make
 * anyway.
 */
export async function createStaff(input: NewStaffInput): Promise<ActionResult<Staff>> {
  const result = await runAction(
    () =>
      apiMutate<Staff>('/team/staff', 'POST', {
        email: input.email,
        username: input.username,
        password: input.password,
        role: input.role,
        ...(input.parentId ? { parentId: input.parentId } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      }),
    'Staff member created.',
  );

  if (result.ok) revalidatePath('/staff');
  return result;
}

export async function updateStaff(
  id: string,
  payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  },
): Promise<ActionResult<Staff>> {
  const result = await runAction(
    () => apiMutate<Staff>(`/team/staff/${id}`, 'PATCH', payload),
    'Staff member updated.',
  );

  if (result.ok) {
    revalidatePath('/staff');
    revalidatePath(`/staff/${id}`);
  }

  return result;
}

/**
 * Issues a new password.
 *
 * Returned once and never recoverable, same as the customer equivalent —
 * the caller has to show it immediately.
 */
export async function resetStaffPassword(id: string): Promise<ActionResult<{ password: string }>> {
  return runAction(
    () => apiMutate<{ password: string }>(`/team/staff/${id}/reset-password`, 'POST'),
    'Password reset. Copy it now — it cannot be shown again.',
  );
}

/**
 * Updates the signed-in member's own profile.
 *
 * There is no `/team/staff/me` on the API — self-service goes through the
 * ordinary staff route with the caller's own id, which the scoping already
 * permits. Only these four fields are editable; role and parent are not
 * self-service by design.
 */
export async function updateOwnProfile(input: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}): Promise<ActionResult<Staff>> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Not signed in.', code: 'AUTH_UNAUTHENTICATED' };

  const result = await runAction(
    () => apiMutate<Staff>(`/team/staff/${actor.id}`, 'PATCH', input),
    'Profile updated.',
  );

  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

/**
 * Changes the signed-in member's own password.
 *
 * The current password is required and checked by the API. That is what
 * separates this from an administrative reset: a reset proves authority
 * over an account, while this proves possession of it — so an unlocked
 * laptop is not enough to take someone's account over.
 *
 * A master is exempt, per the operator's instruction, and goes through the
 * administrative reset path instead.
 *
 * Every session is revoked on success, including this one, so the caller
 * signs back in with the new password.
 */
export async function changeOwnPassword(
  newPassword: string,
  currentPassword?: string,
): Promise<ActionResult<unknown>> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Not signed in.', code: 'AUTH_UNAUTHENTICATED' };

  if (actor.role === 'master') {
    return runAction(
      () =>
        apiMutate<unknown>(`/team/staff/${actor.id}/reset-password`, 'POST', {
          newPassword,
          mustChangePassword: false,
        }),
      'Password updated.',
    );
  }

  if (!currentPassword) {
    return {
      ok: false,
      message: 'Enter your current password.',
      code: 'VALIDATION_FAILED',
      fieldErrors: { currentPassword: 'Enter your current password.' },
    };
  }

  return runAction(
    () =>
      apiMutate<unknown>('/auth/team/change-password', 'POST', { currentPassword, newPassword }),
    'Password changed. Sign in again with the new password.',
  );
}
