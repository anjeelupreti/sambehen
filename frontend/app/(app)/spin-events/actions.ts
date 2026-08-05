'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { SpinEvent } from '@/lib/types';

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
