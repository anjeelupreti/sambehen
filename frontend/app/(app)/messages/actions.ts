'use server';

import { apiGet, apiList, apiMutate } from '@/lib/api';
import { fromCustomerThreadForStaff } from '@/components/chat/mappers';
import type { ChatMessage, ThreadPage } from '@/components/chat/types';
import { getAccessToken, getActor } from '@/lib/session';
import type { Conversation, Message, MessageAttachment } from '@/lib/types';

/**
 * Server actions for customer conversations, as staff see them.
 *
 * Everything here runs on the server because the API client does: the
 * bearer token lives in an httpOnly cookie that browser JavaScript cannot
 * read.
 *
 * Mind the ids: reading and marking read take a **conversation** id; only
 * sending takes a customer id, because sending is what creates the
 * conversation when none exists.
 */

/** The inbox, scoped by the API to what the caller may see. */
export async function listConversations(): Promise<Conversation[]> {
  try {
    const { data } = await apiList<Conversation>('/team/conversations', { query: { limit: 100 } });
    return data;
  } catch {
    return [];
  }
}

/**
 * One page of a thread, oldest first, with how far the customer has read.
 * Opening a thread also marks it read for this viewer (the API does that).
 */
export async function loadThread(conversationId: string, before?: string): Promise<ThreadPage> {
  const [actor, page] = await Promise.all([
    getActor(),
    apiGet<{ data: Message[]; nextCursor: string | null; customerReadAt: string | null }>(
      `/team/conversations/${conversationId}/messages`,
      { query: { limit: 50, ...(before ? { before } : {}) } },
    ),
  ]);
  return {
    messages: [...page.data]
      .reverse()
      .map((m) => fromCustomerThreadForStaff(m, actor?.username ?? '')),
    nextCursor: page.nextCursor,
    readAt: page.customerReadAt,
  };
}

/** Marks a thread read for this viewer, e.g. when a message arrives while it is open. */
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await apiMutate<unknown>(`/team/conversations/${conversationId}/read`, 'POST');
  } catch {
    // Read state is best-effort; the next open marks it again.
  }
}

/** Sends a reply. Starts the thread when there is none. */
export async function sendReply(
  customerId: string,
  body: string,
  attachments: MessageAttachment[],
): Promise<ChatMessage | null> {
  try {
    const [actor, message] = await Promise.all([
      getActor(),
      apiMutate<Message>('/team/conversations/messages', 'POST', {
        customerId,
        body,
        ...(attachments.length ? { attachments } : {}),
      }),
    ]);
    return fromCustomerThreadForStaff(message, actor?.username ?? '');
  } catch {
    return null;
  }
}

/**
 * Hands the access token to the browser so it can open the messaging socket.
 *
 * A deliberate, narrow exception to the rule that the browser never holds a
 * token: a WebSocket is opened by the browser and the gateway authenticates
 * the handshake. It is the short-lived access token only, fetched on
 * connect and kept in a variable rather than storage.
 */
export async function getSocketToken(): Promise<string | null> {
  return getAccessToken();
}
