'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { Staff } from '@/lib/types';

/**
 * Staff mutations.
 *
 * A manager may act on their own runners and nobody else's; the API
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
  role: 'manager' | 'runner';
  parentId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Creates a staff member.
 *
 * Only two roles can be created: a master makes managers or runners, a
 * manager makes runners under themselves. There is no second master — the
 * API rejects it, and offering it here would produce a confusing 422.
 *
 * `parentId` is omitted when a manager creates a runner: the API places the
 * runner under the caller, which is the only placement a manager could make
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
