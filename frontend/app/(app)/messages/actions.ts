'use server';

import { revalidatePath } from 'next/cache';

import { apiGet, apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import { getAccessToken } from '@/lib/session';
import type { ActionResult } from '@/lib/action-result';
import type { Conversation, Message, MessageAttachment } from '@/lib/types';

/**
 * Server actions for messaging.
 *
 * Everything here runs on the server because the API client does: the bearer
 * token lives in an httpOnly cookie that browser JavaScript cannot read, so
 * a client component calling `apiList` directly would have no credential
 * even if `server-only` allowed it to compile.
 *
 * Note the ids. `/team/conversations/{id}/messages` and `/{id}/read` take a
 * **conversation** id; only sending takes a customer id, because sending is
 * what creates the conversation when none exists. Passing a customer id to
 * the first two returns nothing and looks like an empty thread.
 */

/** The inbox, scoped by the API to what the caller may see. */
export async function listConversations(): Promise<Conversation[]> {
  try {
    const { data } = await apiList<Conversation>('/team/conversations', {
      query: { limit: 50 },
    });
    return data;
  } catch {
    return [];
  }
}

/**
 * A thread, oldest first.
 *
 * The API returns newest-first because that is what pagination needs.
 * Reversing here keeps that detail in one place rather than in every
 * component that renders a conversation.
 */
export async function loadMessages(conversationId: string): Promise<Message[]> {
  try {
    // This route is cursor-paginated, so its payload is
    // `{ data, nextCursor }` rather than a bare array — one level deeper
    // than every other list in the API.
    const thread = await apiGet<{ data: Message[]; nextCursor: string | null }>(
      `/team/conversations/${conversationId}/messages`,
      { query: { limit: 100 } },
    );

    return [...(thread?.data ?? [])].reverse();
  } catch {
    return [];
  }
}

/*
 * Aliases for the messaging FAB, which uses a different vocabulary.
 *
 * Written as async functions rather than `export const x = y`: a
 * 'use server' module may only export async functions, and a re-exported
 * binding fails that check at build time.
 */
export async function getConversations(): Promise<Conversation[]> {
  return listConversations();
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return loadMessages(conversationId);
}

export async function markAsRead(conversationId: string): Promise<ActionResult<unknown>> {
  return markConversationRead(conversationId);
}

export async function markConversationRead(conversationId: string): Promise<ActionResult<unknown>> {
  return runAction(
    () => apiMutate<unknown>(`/team/conversations/${conversationId}/read`, 'POST'),
    'Marked as read.',
  );
}

/**
 * Sends a message to a customer.
 *
 * The same call starts a thread and continues one — the API keys on the
 * customer rather than on a conversation id, so there is no separate
 * "start" path to keep in step.
 */
export async function sendMessage(
  customerId: string,
  body: string,
  attachments?: MessageAttachment[],
): Promise<ActionResult<Message>> {
  const result = await runAction(
    () =>
      apiMutate<Message>('/team/conversations/messages', 'POST', {
        customerId,
        body,
        ...(attachments?.length ? { attachments } : {}),
      }),
    'Message sent.',
  );

  if (result.ok) revalidatePath('/dashboard');
  return result;
}

/**
 * Hands the access token to the browser so it can open the messaging socket.
 *
 * A deliberate, narrow exception to the rule that the browser never holds a
 * token: a WebSocket is opened *by the browser* and the gateway
 * authenticates the handshake, so there is no way around it. It is the
 * short-lived access token only, fetched on connect rather than embedded in
 * the page, and the caller keeps it in a variable rather than storage.
 */
export async function getSocketToken(): Promise<string | null> {
  return getAccessToken();
}
