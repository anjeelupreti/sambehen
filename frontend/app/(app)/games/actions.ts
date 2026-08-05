'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';

export async function createGame(payload: {
  name: string;
  code: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}) {
  await apiMutate('/team/games', 'POST', payload);
  revalidatePath('/games');
  return { ok: true, message: 'Game created' } as const;
}

export async function updateGame(
  id: string,
  payload: {
    name?: string;
    category?: string;
    description?: string;
    imageUrl?: string;
    isActive?: boolean;
  },
) {
  await apiMutate(`/team/games/${id}`, 'PATCH', payload);
  revalidatePath('/games');
  return { ok: true, message: 'Game updated' } as const;
}
