'use server';

import { revalidatePath } from 'next/cache';

import { apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { components } from '@/lib/api-schema';

type Program = components['schemas']['ReferralProgramResponseDto'];
type Code = components['schemas']['ReferralCodeResponseDto'];
export type RewardType = 'fixed' | 'percentage';

/**
 * Referral programs, the codes issued under them, and the resulting ledger.
 *
 * Three things sit behind one page because they are one chain: a program
 * defines the reward, codes are issued to customers under it, and referrals
 * are what those codes produced. Reading any one apart from the others
 * makes it hard to answer the only question that matters — is this program
 * actually earning anything.
 *
 * Bonuses are money and stay strings end to end.
 */

export interface ProgramInput {
  name: string;
  rewardType: RewardType;
  referrerBonus: string;
  refereeBonus: string;
  validFrom: string;
  description?: string;
  minQualifyingDebit?: string;
  maxRewardsPerReferrer?: number;
  validTo?: string;
}

export async function createReferralProgram(input: ProgramInput): Promise<ActionResult<Program>> {
  const result = await runAction(
    () => apiMutate<Program>('/team/referral-programs', 'POST', input),
    'Referral program created.',
  );

  if (result.ok) revalidatePath('/referrals');
  return result;
}

export async function updateReferralProgram(
  id: string,
  input: Partial<Omit<ProgramInput, 'rewardType' | 'validFrom'>> & { isActive?: boolean },
): Promise<ActionResult<Program>> {
  // `rewardType` and `validFrom` are absent on purpose: the API does not
  // accept them on update. Changing how a live program rewards people, or
  // when it started, would rewrite the terms under which codes were already
  // issued.
  const result = await runAction(
    () => apiMutate<Program>(`/team/referral-programs/${id}`, 'PATCH', input),
    'Program updated.',
  );

  if (result.ok) revalidatePath('/referrals');
  return result;
}

/**
 * Issues codes to customers under a program.
 *
 * One call, many customers — the API takes up to 500 ids and generates a
 * code each, so this is the bulk path rather than one request per customer.
 */
export async function assignReferralCodes(
  programId: string,
  customerIds: string[],
  options: { maxUses?: number; expiresAt?: string } = {},
): Promise<ActionResult<{ issued: Code[] }>> {
  // The API answers `{ issued: [...] }` rather than a bare array — one level
  // deeper than the other list responses.
  const result = await runAction(
    () =>
      apiMutate<{ issued: Code[] }>(`/team/referral-programs/${programId}/assign`, 'POST', {
        ids: customerIds,
        ...(options.maxUses ? { maxUses: options.maxUses } : {}),
        ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
      }),
    `Issued ${customerIds.length} code${customerIds.length === 1 ? '' : 's'}.`,
  );

  if (result.ok) revalidatePath('/referrals');
  return result;
}

/** Codes already issued under a program. */
export async function loadProgramCodes(programId: string): Promise<Code[]> {
  try {
    const { data } = await apiList<Code>(`/team/referral-programs/${programId}/codes`, {
      query: { limit: 100 },
    });
    return data;
  } catch {
    return [];
  }
}

/** Customers who could be issued a code, for the assign picker. */
export async function searchAssignableCustomers(query: string) {
  try {
    const { data } = await apiList<components['schemas']['CustomerResponseDto']>(
      '/team/customers',
      { query: { search: query.trim() || undefined, limit: 25, status: 'active' } },
    );
    return data.map((customer) => ({
      id: customer.id,
      username: customer.username,
      fullName: customer.fullName,
    }));
  } catch {
    return [];
  }
}
