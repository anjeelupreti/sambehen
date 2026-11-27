'use server';

import { customerMutate } from '@/lib/customer-api';

/** Whether the player's own wins appear, by first name and last initial, in the feed. */
export async function setShowMyWins(show: boolean): Promise<boolean> {
  try {
    await customerMutate('/me/wins/visibility', 'PUT', { show });
    return true;
  } catch {
    return false;
  }
}
