'use server';

import { revalidatePath } from 'next/cache';

import { apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { Customer, CustomerStatus } from '@/lib/types';

/**
 * Customer mutations.
 *
 * Everything about a customer is changed by staff — customers can read
 * their own record but never edit it, including their own password. That is
 * an API rule; these actions simply reflect it.
 *
 * Each one revalidates both the list and the detail page, because a status
 * change alters the badge in one and the header in the other, and leaving
 * either stale shows the user their change did not take.
 */
export async function changeCustomerStatus(
  id: string,
  status: CustomerStatus,
  reason?: string,
): Promise<ActionResult<Customer>> {
  const result = await runAction(
    () =>
      apiMutate<Customer>(`/team/customers/${id}/status`, 'PATCH', {
        status,
        ...(reason ? { reason } : {}),
      }),
    `Customer ${status === 'active' ? 'reactivated' : status}.`,
  );

  if (result.ok) {
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
  }

  return result;
}

/**
 * Issues a new password.
 *
 * The API returns the generated password once and never again — it is not
 * stored in readable form. The caller must show it to the user immediately;
 * there is no way to retrieve it afterwards.
 */
export async function resetCustomerPassword(
  id: string,
): Promise<ActionResult<{ password: string }>> {
  return runAction(
    () => apiMutate<{ password: string }>(`/team/customers/${id}/reset-password`, 'POST'),
    'Password reset. Copy it now — it cannot be shown again.',
  );
}

export interface NewCustomerInput {
  email: string;
  username: string;
  password: string;
  /**
   * Who ends up owning the customer.
   *
   * Required for a master: ownership defaults to the caller, and a master
   * sits above the chain rather than in it, so defaulting would fail with
   * `CUSTOMER_INVALID_OWNER`. A manager may name one of their runners or
   * omit it to take the customer themselves; a runner's choice is ignored
   * by the API, which always assigns to them.
   */
  ownerStaffId?: string;
  fullName?: string;
  phone?: string;
  city?: string;
  country?: string;
  notes?: string;
}

/**
 * Creates a customer.
 *
 * The password is set by staff here and can only ever be changed by staff —
 * a customer can read their own record but never edit it, including their
 * own credentials. That is an API rule this form simply reflects.
 *
 * The new customer is owned by whoever created them unless a specific owner
 * is supplied, which is what a runner adding their own customer expects.
 */
export async function createCustomer(input: NewCustomerInput): Promise<ActionResult<Customer>> {
  const result = await runAction(
    () =>
      apiMutate<Customer>('/team/customers', 'POST', {
        email: input.email,
        username: input.username,
        password: input.password,
        ...(input.ownerStaffId ? { ownerStaffId: input.ownerStaffId } : {}),
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.city ? { city: input.city } : {}),
        ...(input.country ? { country: input.country } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    'Customer created.',
  );

  if (result.ok) {
    revalidatePath('/customers');
    revalidatePath('/dashboard');
  }

  return result;
}

export async function reassignCustomer(
  id: string,
  ownerStaffId: string,
): Promise<ActionResult<Customer>> {
  const result = await runAction(
    () => apiMutate<Customer>(`/team/customers/${id}/reassign`, 'PATCH', { ownerStaffId }),
    'Customer reassigned.',
  );

  if (result.ok) {
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
  }

  return result;
}
