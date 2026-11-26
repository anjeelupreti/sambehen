'use server';

import { apiGet, apiList, apiMutate } from '@/lib/api';
import { fromCustomerThreadForStaff } from '@/components/chat/mappers';
import type { ChatMessage, ThreadPage } from '@/components/chat/types';
import { getAccessToken, getActor } from '@/lib/session';
import type { Conversation, ConversationSummary, Message, MessageAttachment } from '@/lib/types';

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

export type InboxChip = 'all' | 'unread' | 'awaiting' | 'vip' | 'new' | 'big';
export type InboxSort = 'attention' | 'waiting' | 'recent';

export interface InboxQuery {
  chip?: InboxChip;
  sort?: InboxSort;
  labelId?: string;
  storeId?: string;
  managerId?: string;
  search?: string;
  page?: number;
}

export interface InboxPage {
  data: Conversation[];
  hasMore: boolean;
  summary: ConversationSummary | null;
}

const PAGE_SIZE = 40;

/**
 * One page of the inbox, filtered and sorted by the API so it stays fast
 * however many conversations there are. The summary counts the inbox
 * before any chip is applied, for the chip badges.
 */
export async function listInbox(query: InboxQuery = {}): Promise<InboxPage> {
  const chip = query.chip ?? 'all';
  try {
    const result = await apiList<Conversation, ConversationSummary>('/team/conversations', {
      query: {
        limit: PAGE_SIZE,
        page: query.page ?? 1,
        sort: query.sort ?? 'attention',
        search: query.search?.trim() || undefined,
        labelId: query.labelId || undefined,
        storeId: query.storeId || undefined,
        managerId: query.managerId || undefined,
        unreadOnly: chip === 'unread' || undefined,
        awaitingReply: chip === 'awaiting' || undefined,
        vip: chip === 'vip' || undefined,
        newCustomers: chip === 'new' || undefined,
        bigSpenders: chip === 'big' || undefined,
      },
    });
    return {
      data: result.data,
      hasMore: Boolean(result.meta?.hasNextPage),
      summary: result.summary ?? null,
    };
  } catch {
    return { data: [], hasMore: false, summary: null };
  }
}

/** The inbox's first page with default filters, for callers that just want the list. */
export async function listConversations(): Promise<Conversation[]> {
  return (await listInbox()).data;
}

/** Marks a conversation unread again, for this viewer only. */
export async function markConversationUnread(conversationId: string): Promise<boolean> {
  try {
    await apiMutate<unknown>(`/team/conversations/${conversationId}/unread`, 'POST');
    return true;
  } catch {
    return false;
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
