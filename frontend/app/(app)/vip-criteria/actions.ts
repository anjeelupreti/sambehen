'use server';

import { revalidatePath } from 'next/cache';

import { apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { VipCriteria } from '@/lib/types';

/*
 * These use the same `runAction` / `ActionResult` convention as every other
 * action in the app: one shape for success and failure, 422 field errors
 * carried back rather than thrown across the server/client boundary where
 * the message would be replaced by a generic digest.
 */
export async function createVipCriteria(
  data: Partial<VipCriteria>,
): Promise<ActionResult<VipCriteria>> {
  const result = await runAction(
    () => apiMutate<VipCriteria>('/team/vip-criteria', 'POST', data),
    'Criteria created.',
  );

  if (result.ok) revalidatePath('/vips');
  return result;
}

export async function updateVipCriteria(
  id: string,
  data: Partial<VipCriteria>,
): Promise<ActionResult<VipCriteria>> {
  const result = await runAction(
    () => apiMutate<VipCriteria>(`/team/vip-criteria/${id}`, 'PATCH', data),
    'Criteria updated.',
  );

  if (result.ok) revalidatePath('/vips');
  return result;
}

/**
 * Recomputes qualification for a criteria.
 *
 * VIP standing is derived from recorded activity, never typed in, so this
 * re-runs the engine and reports what changed rather than editing anyone's
 * status directly.
 */
export async function recomputeVipCriteria(
  id: string,
): Promise<ActionResult<{ qualified: number; removed: number }>> {
  const result = await runAction(
    () =>
      apiMutate<{ qualified: number; removed: number }>(
        `/team/vip-criteria/${id}/recompute`,
        'POST',
      ),
    'Qualification recomputed.',
  );

  if (result.ok) {
    revalidatePath('/vip-criteria');
    revalidatePath('/vips');
  }

  return result;
}

export async function deleteVipCriteria(id: string): Promise<ActionResult<unknown>> {
  const result = await runAction(
    () => apiMutate<unknown>(`/team/vip-criteria/${id}`, 'DELETE'),
    'Criteria deleted.',
  );

  if (result.ok) {
    revalidatePath('/vip-criteria');
    revalidatePath('/vips');
  }

  return result;
}

/** Active criteria, for pickers. A spin event runs against one of these. */
export async function listActiveVipCriteria(): Promise<VipCriteria[]> {
  try {
    const { data } = await apiList<VipCriteria>('/team/vip-criteria', {
      query: { isActive: true, limit: 100 },
    });
    return data;
  } catch {
    return [];
  }
}
