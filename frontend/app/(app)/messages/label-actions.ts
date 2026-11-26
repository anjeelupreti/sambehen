'use server';

import { ApiError, apiGet, apiList, apiMutate } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import type { Customer, Staff } from '@/lib/types';

export type Label = components['schemas']['LabelWithUsageDto'];
export type LabelColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'pink' | 'teal' | 'gray';

/** Every label, with how many of the viewer's players carry each. */
export async function listLabels(): Promise<Label[]> {
  try {
    return await apiGet<Label[]>('/team/labels');
  } catch {
    return [];
  }
}

export interface LabelResult {
  ok: boolean;
  message?: string;
}

const failure = (error: unknown): LabelResult => ({
  ok: false,
  message:
    error instanceof ApiError && error.status === 409
      ? 'A label with that name already exists.'
      : error instanceof ApiError && error.status === 403
        ? 'Only the master can change labels.'
        : 'That didn’t save. Try again.',
});

export async function createLabel(name: string, color: LabelColor): Promise<LabelResult> {
  try {
    await apiMutate('/team/labels', 'POST', { name, color });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateLabel(
  id: string,
  changes: { name?: string; color?: LabelColor },
): Promise<LabelResult> {
  try {
    await apiMutate(`/team/labels/${id}`, 'PATCH', changes);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteLabel(id: string): Promise<LabelResult> {
  try {
    await apiMutate(`/team/labels/${id}`, 'DELETE');
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Replaces a player's labels and returns the saved set. */
export async function setPlayerLabels(customerId: string, labelIds: string[]) {
  try {
    const labels = await apiMutate<Customer['labels']>(
      `/team/customers/${customerId}/labels`,
      'PUT',
      { labelIds },
    );
    return { ok: true as const, labels };
  } catch (error) {
    return { ...failure(error), labels: null };
  }
}

/** The player record behind a conversation, for the side panel. */
export async function getPlayer(customerId: string): Promise<Customer | null> {
  try {
    return await apiGet<Customer>(`/team/customers/${customerId}`);
  } catch {
    return null;
  }
}

/** Stores and managers the viewer can narrow the inbox to. */
export async function listInboxScopes(): Promise<{ managers: Staff[]; stores: Staff[] }> {
  try {
    const [managers, stores] = await Promise.all([
      apiList<Staff>('/team/staff', { query: { role: 'manager', limit: 100 } }),
      apiList<Staff>('/team/staff', { query: { role: 'store', limit: 100 } }),
    ]);
    return { managers: managers.data, stores: stores.data };
  } catch {
    return { managers: [], stores: [] };
  }
}
