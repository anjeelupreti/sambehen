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
