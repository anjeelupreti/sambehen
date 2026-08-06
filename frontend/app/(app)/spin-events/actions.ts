'use server';

import { revalidatePath } from 'next/cache';

import { apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { SpinEvent, Vip } from '@/lib/types';

/**
 * Creates a spin event.
 *
 * An event runs against an active VIP criteria — that criteria is what
 * decides who is eligible, so the API refuses an event without one. The
 * form fetches the list of active criteria through
 * `listActiveVipCriteria` rather than calling the API from the browser,
 * where there is no token to call it with.
 */
export async function createSpinEvent(
  input: Record<string, unknown>,
): Promise<ActionResult<SpinEvent>> {
  const result = await runAction(
    () => apiMutate<SpinEvent>('/team/spin-events', 'POST', input),
    'Spin event created.',
  );

  if (result.ok) revalidatePath('/spin-events');
  return result;
}

/**
 * Customers who already hold a qualification for a criteria.
 *
 * Preselected winners must be drawn from these — the API rejects anyone
 * without a qualification for the event's criteria, so offering the full
 * customer list would invite a 422 the user cannot act on.
 */
export async function listQualifiedCustomers(criteriaId: string) {
  if (!criteriaId) return [];

  try {
    const { data } = await apiList<Vip>('/team/vips', {
      query: { criteriaId, activeOnly: true, limit: 100 },
    });

    // One row per qualification; a customer can hold several, so collapse.
    const seen = new Map<string, { id: string; username: string; tier: number }>();
    for (const vip of data) {
      if (!seen.has(vip.customerId)) {
        seen.set(vip.customerId, {
          id: vip.customerId,
          username: vip.customerUsername ?? 'unknown',
          tier: vip.tier,
        });
      }
    }

    return [...seen.values()];
  } catch {
    return [];
  }
}
