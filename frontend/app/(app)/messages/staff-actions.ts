'use server';

import { apiGet, apiList, apiMutate } from '@/lib/api';
import { fromStaffThread } from '@/components/chat/mappers';
import type { ChatMessage, ThreadPage } from '@/components/chat/types';
import { getActor } from '@/lib/session';
import type { MessageAttachment, StaffContact, StaffConversation, StaffMessage } from '@/lib/types';

/**
 * Server actions for internal staff-to-staff messaging: different routes
 * (`/team/staff-conversations`), different participants, and the same
 * thread model as customer conversations on screen.
 */

/** Staff the caller may open a chat with, scoped by hierarchy on the server. */
export async function listStaffContacts(search?: string): Promise<StaffContact[]> {
  try {
    const { data } = await apiList<StaffContact>('/team/staff-conversations/contacts', {
      query: { search: search?.trim() || undefined },
    });
    return data;
  } catch {
    return [];
  }
}

export async function listStaffConversations(): Promise<StaffConversation[]> {
  try {
    const { data } = await apiList<StaffConversation>('/team/staff-conversations', {
      query: { limit: 50 },
    });
    return data;
  } catch {
    return [];
  }
}

/** One page of a thread, oldest first, with how far the other person has read. */
export async function loadStaffThread(
  conversationId: string,
  before?: string,
): Promise<ThreadPage> {
  const [actor, page] = await Promise.all([
    getActor(),
    apiGet<{ data: StaffMessage[]; nextCursor: string | null; otherReadAt: string | null }>(
      `/team/staff-conversations/${conversationId}/messages`,
      { query: { limit: 50, ...(before ? { before } : {}) } },
    ),
  ]);
  return {
    messages: [...page.data].reverse().map((m) => fromStaffThread(m, actor?.id ?? '')),
    nextCursor: page.nextCursor,
    readAt: page.otherReadAt,
  };
}

export async function markStaffConversationRead(conversationId: string): Promise<void> {
  try {
    await apiMutate<unknown>(`/team/staff-conversations/${conversationId}/read`, 'POST');
  } catch {
    // Read state is best-effort; the next open marks it again.
  }
}

/**
 * Sends an internal message, keyed on the colleague rather than a thread:
 * the same call starts a chat and continues one. Returns the thread id too,
 * so a brand-new chat can switch from "contact" to "conversation".
 */
export async function sendStaffReply(
  targetStaffId: string,
  body: string,
  attachments: MessageAttachment[],
): Promise<{ message: ChatMessage; conversationId: string } | null> {
  try {
    const [actor, message] = await Promise.all([
      getActor(),
      apiMutate<StaffMessage>('/team/staff-conversations/messages', 'POST', {
        targetStaffId,
        body,
        ...(attachments.length ? { attachments } : {}),
      }),
    ]);
    return {
      message: fromStaffThread(message, actor?.id ?? ''),
      conversationId: message.conversationId,
    };
  } catch {
    return null;
  }
}
