'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import type { ActionResult } from '@/lib/action-result';
import type { components } from '@/lib/api-schema';
import { runAction } from '@/lib/run-action';

export type StaffWin = components['schemas']['WinDto'];

export interface RecordWinInput {
  customerId: string;
  gameId?: string;
  amount: string;
  wonAt?: string;
}

export async function recordWin(input: RecordWinInput): Promise<ActionResult<StaffWin>> {
  const result = await runAction(
    () =>
      apiMutate<StaffWin>('/team/wins', 'POST', {
        customerId: input.customerId,
        amount: input.amount,
        ...(input.gameId ? { gameId: input.gameId } : {}),
        ...(input.wonAt ? { wonAt: new Date(input.wonAt).toISOString() } : {}),
      }),
    'Win recorded.',
  );
  if (result.ok) revalidatePath('/wins');
  return result;
}

export async function setWinHidden(id: string, hidden: boolean): Promise<ActionResult<StaffWin>> {
  const result = await runAction(
    () => apiMutate<StaffWin>(`/team/wins/${id}`, 'PATCH', { hidden }),
    hidden ? 'Hidden from players.' : 'Shown to players.',
  );
  if (result.ok) revalidatePath('/wins');
  return result;
}

export async function deleteWin(id: string): Promise<ActionResult<null>> {
  const result = await runAction(
    () => apiMutate<null>(`/team/wins/${id}`, 'DELETE'),
    'Win deleted.',
  );
  if (result.ok) revalidatePath('/wins');
  return result;
}
