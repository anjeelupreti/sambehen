'use server';

import { revalidatePath } from 'next/cache';

import { apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { Customer, Transaction, TransactionType } from '@/lib/types';

export interface TransactionInput {
  customerId: string;
  type: TransactionType;
  amount: string;
  gameId?: string;
  channel?: string;
  referenceNo?: string;
  note?: string;
  occurredAt?: string;
}

/**
 * Records an entry against a customer.
 *
 * Amount, type and customer are immutable once written — the API refuses to
 * edit them, and a wrong figure is fixed with a correction so the original
 * stays visible. That makes this the one form in the app where getting it
 * right first matters, which is why the modal restates the direction of
 * money rather than relying on the words "debit" and "credit" alone.
 */
export async function createTransaction(
  input: TransactionInput,
): Promise<ActionResult<Transaction>> {
  const result = await runAction(
    () =>
      apiMutate<Transaction>('/team/transactions', 'POST', {
        customerId: input.customerId,
        type: input.type,
        amount: input.amount,
        ...(input.gameId ? { gameId: input.gameId } : {}),
        ...(input.channel ? { channel: input.channel } : {}),
        ...(input.referenceNo ? { referenceNo: input.referenceNo } : {}),
        ...(input.note ? { note: input.note } : {}),
        ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt).toISOString() } : {}),
      }),
    input.type === 'debit' ? 'Deposit recorded.' : 'Withdrawal recorded.',
  );

  if (result.ok) {
    revalidatePath('/transactions');
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Corrects an earlier entry.
 *
 * The API writes a credit carrying the original's id as its parent. That
 * parent link is what keeps it out of `totalWithdrawn` — a correction is a
 * fix, not money the customer took out.
 */
export async function createCorrection(
  transactionId: string,
  amount: string,
  reason: string,
): Promise<ActionResult<Transaction>> {
  const result = await runAction(
    () =>
      apiMutate<Transaction>(`/team/transactions/${transactionId}/correction`, 'POST', {
        amount,
        reason,
      }),
    'Correction recorded against the original entry.',
  );

  if (result.ok) {
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Customer lookup for the entry form.
 *
 * Scoped by the API like every other list, so a runner searching here can
 * only ever find their own customers. Returns the few fields the picker
 * shows and nothing else.
 */
export async function searchCustomers(
  query: string,
): Promise<{ id: string; username: string; fullName: string | null }[]> {
  if (query.trim().length < 2) return [];

  try {
    const { data } = await apiList<Customer>('/team/customers', {
      query: { search: query.trim(), limit: 10, status: 'active' },
    });

    return data.map((customer) => ({
      id: customer.id,
      username: customer.username,
      fullName: customer.fullName,
    }));
  } catch {
    // The picker degrades to "no matches" rather than breaking the form
    // around it; the user can still cancel or correct the search.
    return [];
  }
}
