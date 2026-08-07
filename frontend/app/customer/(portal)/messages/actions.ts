'use server';

import { revalidatePath } from 'next/cache';

import { customerGet, customerMutate } from '@/lib/customer-api';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { Message, MessageAttachment } from '@/lib/types';

/**
 * The customer side of messaging.
 *
 * A customer has exactly one thread — with the business — so there is no
 * conversation to choose. The API keys everything off the authenticated
 * customer, which is why none of these take an id.
 */

/** The thread, oldest first for rendering. */
export async function loadMyMessages(): Promise<Message[]> {
  try {
    const thread = await customerGet<{ data: Message[]; nextCursor: string | null }>(
      '/me/messages',
      { limit: 100 },
    );
    return [...(thread?.data ?? [])].reverse();
  } catch {
    return [];
  }
}

export async function sendMyMessage(
  body: string,
  attachments?: MessageAttachment[],
): Promise<ActionResult<Message>> {
  const result = await runAction(
    () =>
      customerMutate<Message>('/me/messages', 'POST', {
        body,
        ...(attachments?.length ? { attachments } : {}),
      }),
    'Message sent.',
  );

  if (result.ok) revalidatePath('/customer/messages');
  return result;
}

/**
 * The token the browser needs to open the messaging socket.
 *
 * Same narrow exception as the staff side: a WebSocket is opened by the
 * browser and the gateway authenticates the handshake, so there is no way
 * to connect without the browser holding a token. It is the short-lived
 * customer access token, fetched on connect rather than embedded in the
 * page, and kept in a variable rather than storage.
 */
export async function getCustomerSocketToken(): Promise<string | null> {
  return getCustomerAccessToken();
}
