'use server';

import { apiGet, apiList, apiMutate } from '@/lib/api';
import { runAction } from '@/lib/run-action';
import type { ActionResult } from '@/lib/action-result';
import type { MessageAttachment, StaffContact, StaffConversation, StaffMessage } from '@/lib/types';

/**
 * Server actions for internal staff-to-staff messaging.
 *
 * A separate surface from `./actions.ts`: different backend routes
 * (`/team/staff-conversations` rather than `/team/conversations`),
 * different participants, and no reason to share code beyond the
 * `apiMutate`/`apiList` primitives both already use.
 */

/** Staff the caller may open a DM with — scoped by hierarchy on the server. */
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

/** A thread, oldest first — the API returns newest-first for pagination. */
export async function loadStaffMessages(conversationId: string): Promise<StaffMessage[]> {
  try {
    const thread = await apiGet<{ data: StaffMessage[]; nextCursor: string | null }>(
      `/team/staff-conversations/${conversationId}/messages`,
      { query: { limit: 100 } },
    );
    return [...(thread?.data ?? [])].reverse();
  } catch {
    return [];
  }
}

export async function markStaffConversationRead(
  conversationId: string,
): Promise<ActionResult<unknown>> {
  return runAction(
    () => apiMutate<unknown>(`/team/staff-conversations/${conversationId}/read`, 'POST'),
    'Marked as read.',
  );
}

/**
 * Sends an internal message.
 *
 * Keyed on the target staff id rather than a conversation id — the same
 * call starts a thread and continues one, so there is no separate "start"
 * path to keep in step with this one.
 */
export async function sendStaffMessage(
  targetStaffId: string,
  body: string,
  attachments?: MessageAttachment[],
): Promise<ActionResult<StaffMessage>> {
  return runAction(
    () =>
      apiMutate<StaffMessage>('/team/staff-conversations/messages', 'POST', {
        targetStaffId,
        body,
        ...(attachments?.length ? { attachments } : {}),
      }),
    'Message sent.',
  );
}
