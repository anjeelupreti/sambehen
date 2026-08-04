'use server';

import { revalidatePath } from 'next/cache';

import { apiGet, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import { getAccessToken } from '@/lib/session';
import type { ActionResult } from '@/lib/action-result';
import type { Message } from '@/lib/types';

/**
 * Sends a message to a customer.
 *
 * The same call starts a thread and continues one — the API keys on the
 * customer, not on a conversation id, so there is no separate "start"
 * path to keep in step.
 */
export async function sendMessage(
  customerId: string,
  body: string,
): Promise<ActionResult<Message>> {
  const result = await runAction(
    () => apiMutate<Message>('/team/conversations/messages', 'POST', { customerId, body }),
    'Message sent.',
  );

  if (result.ok) revalidatePath('/messages');
  return result;
}

/**
 * Loads a thread.
 *
 * Called from the client when a conversation is opened, rather than
 * fetching every thread up front — a master can see thousands, and only
 * one is ever on screen.
 *
 * Returns oldest-first for rendering. The API returns newest-first because
 * that is what pagination needs; reversing here keeps that decision in one
 * place instead of in every component that shows a thread.
 */
export async function loadMessages(conversationId: string): Promise<Message[]> {
  try {
    const messages = await apiGet<Message[]>(`/team/conversations/${conversationId}/messages`, {
      query: { limit: 100 },
    });

    return [...messages].reverse();
  } catch {
    return [];
  }
}

export async function markConversationRead(conversationId: string): Promise<ActionResult<unknown>> {
  const result = await runAction(
    () => apiMutate<unknown>(`/team/conversations/${conversationId}/read`, 'POST'),
    'Marked as read.',
  );

  if (result.ok) revalidatePath('/messages');
  return result;
}

/**
 * Hands the access token to the browser so it can open the socket.
 *
 * This is a deliberate, narrow exception to the rule that the browser never
 * holds a token. Everywhere else the token stays in an httpOnly cookie and
 * only the server reads it — but a WebSocket is opened *by the browser*, and
 * the gateway authenticates the handshake with the same bearer token. There
 * is no way to open it without the browser having one.
 *
 * The exposure is limited on purpose:
 *
 * - it is returned to a component that keeps it in a variable, never in
 *   localStorage or sessionStorage, so it dies with the tab;
 * - it is the short-lived access token, not the refresh token, so a leak
 *   expires in minutes and cannot be used to mint new ones;
 * - it is fetched when the socket connects rather than embedded in the
 *   page, so it never appears in the HTML or the RSC payload.
 *
 * The alternative — proxying the socket through this server so the token
 * never leaves it — is the stronger design and the right thing to do if
 * messaging grows. It is noted in docs/UX-STANDARDS.md rather than done
 * silently.
 */
export async function getSocketToken(): Promise<string | null> {
  return getAccessToken();
}
