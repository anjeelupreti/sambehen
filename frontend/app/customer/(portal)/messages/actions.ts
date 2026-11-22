'use server';

import { fromCustomerThreadForCustomer } from '@/components/chat/mappers';
import type { ChatMessage, ThreadPage } from '@/components/chat/types';
import { customerGet, customerMutate } from '@/lib/customer-api';
import { getCustomerAccessToken } from '@/lib/customer-session';
import type { Message, MessageAttachment } from '@/lib/types';

/**
 * The customer side of messaging. A customer has exactly one thread, with
 * their team, so nothing here takes a conversation id: the API keys
 * everything off the signed-in customer.
 */

/** One page of the thread, oldest first, with how far the team has read. */
export async function loadMyThread(before?: string): Promise<ThreadPage> {
  const page = await customerGet<{
    data: Message[];
    nextCursor: string | null;
    teamReadAt: string | null;
  }>('/me/messages', { limit: 50, ...(before ? { before } : {}) });
  return {
    messages: [...(page?.data ?? [])].reverse().map(fromCustomerThreadForCustomer),
    nextCursor: page?.nextCursor ?? null,
    readAt: page?.teamReadAt ?? null,
  };
}

/** Called while the thread is open, so the team's ticks turn read. */
export async function markMyThreadRead(): Promise<void> {
  try {
    await customerMutate<unknown>('/me/messages/read', 'POST');
  } catch {
    // Best-effort; the next open marks it again.
  }
}

export async function sendMine(
  body: string,
  attachments: MessageAttachment[],
): Promise<ChatMessage | null> {
  try {
    const message = await customerMutate<Message>('/me/messages', 'POST', {
      body,
      ...(attachments.length ? { attachments } : {}),
    });
    return fromCustomerThreadForCustomer(message);
  } catch {
    return null;
  }
}

/**
 * The token the browser needs to open the messaging socket: the
 * short-lived access token, fetched on connect and never stored.
 */
export async function getCustomerSocketToken(): Promise<string | null> {
  return getCustomerAccessToken();
}
