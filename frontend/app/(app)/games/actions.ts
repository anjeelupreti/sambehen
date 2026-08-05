'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { Game } from '@/lib/types';

export interface GameInput {
  name: string;
  code: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

/**
 * Creates a game.
 *
 * Routed through `runAction` so a 422 comes back as field errors the form
 * can show beside the offending input. Throwing instead — which this used
 * to do — surfaced as an unhandled ApiError with no indication of which
 * field was wrong. `code` is the one that catches people: the API accepts
 * only `[A-Z0-9_-]`, so "Golden Dragon" uppercases to a value containing a
 * space and is rejected.
 */
export async function createGame(payload: GameInput): Promise<ActionResult<Game>> {
  const result = await runAction(
    () => apiMutate<Game>('/team/games', 'POST', payload),
    'Game created.',
  );

  if (result.ok) revalidatePath('/games');
  return result;
}

export async function updateGame(
  id: string,
  payload: Partial<GameInput> & { isActive?: boolean },
): Promise<ActionResult<Game>> {
  const result = await runAction(
    () => apiMutate<Game>(`/team/games/${id}`, 'PATCH', payload),
    'Game updated.',
  );

  if (result.ok) revalidatePath('/games');
  return result;
}
