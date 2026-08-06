'use server';

import { revalidatePath } from 'next/cache';

import { apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { components } from '@/lib/api-schema';

type Campaign = components['schemas']['CampaignResponseDto'];
type RecipientPreview = components['schemas']['RecipientPreviewDto'];
export type RecipientFilter = components['schemas']['RecipientFilterDto'];
export type EmailKind = NonNullable<components['schemas']['CreateCampaignDto']['emailKind']>;

/**
 * Email broadcasts.
 *
 * This is the only way to reach many customers at once. Messaging is
 * strictly one thread per customer, so "broadcast" here means email, and a
 * customer reads it in their inbox rather than in the portal.
 *
 * Sending is deliberately two steps — compose, then send with an audience —
 * because the audience is chosen *at send time*, not at compose time. That
 * is what makes the preview meaningful: the same draft can be sent to a
 * different set, and the set is confirmed against live data immediately
 * before delivery.
 */

/**
 * Counts and samples the audience a filter selects.
 *
 * `excluded` is the number selected but not sendable — no email address,
 * opted out, or previously hard-bounced. Worth showing next to the total:
 * "412 recipients" reads very differently once you know 18 will not receive
 * it.
 */
export async function previewRecipients(
  filter: RecipientFilter & { sampleSize?: number },
): Promise<ActionResult<RecipientPreview>> {
  return runAction(
    () => apiMutate<RecipientPreview>('/team/email/recipients/preview', 'POST', filter),
    'Audience previewed.',
  );
}

export async function createCampaign(input: {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  emailKind?: EmailKind;
}): Promise<ActionResult<Campaign>> {
  const result = await runAction(
    () => apiMutate<Campaign>('/team/email/campaigns', 'POST', input),
    'Draft saved.',
  );

  if (result.ok) revalidatePath('/broadcast');
  return result;
}

/**
 * Queues a campaign for delivery against an audience.
 *
 * Irreversible once it starts — the API queues the messages and works
 * through them, so the UI confirms before calling this.
 */
export async function sendCampaign(
  id: string,
  filter: RecipientFilter,
): Promise<ActionResult<Campaign>> {
  const result = await runAction(
    () => apiMutate<Campaign>(`/team/email/campaigns/${id}/send`, 'POST', { filter }),
    'Campaign queued for delivery.',
  );

  if (result.ok) revalidatePath('/broadcast');
  return result;
}

export async function cancelCampaign(id: string): Promise<ActionResult<Campaign>> {
  const result = await runAction(
    () => apiMutate<Campaign>(`/team/email/campaigns/${id}/cancel`, 'POST'),
    'Campaign cancelled.',
  );

  if (result.ok) revalidatePath('/broadcast');
  return result;
}

/** Per-recipient delivery outcomes for one campaign. */
export async function loadCampaignRecipients(id: string) {
  try {
    const { data } = await apiList<components['schemas']['CampaignRecipientDto']>(
      `/team/email/campaigns/${id}/recipients`,
      { query: { limit: 100 } },
    );
    return data;
  } catch {
    return [];
  }
}
