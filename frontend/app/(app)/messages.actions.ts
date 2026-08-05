'use server';

import { apiList, apiGet, apiMutate } from '@/lib/api';
import type { Conversation, Message } from '@/lib/types';

export async function getConversations() {
  try {
    const res = await apiList<Conversation>('/team/conversations', { query: { limit: 50 } });
    return res.data;
  } catch (error) {
    console.error('Failed to get conversations', error);
    return [];
  }
}

export async function getMessages(customerId: string) {
  try {
    const res = await apiGet<{ data: Message[] }>(`/team/conversations/${customerId}/messages`);
    return res.data;
  } catch (error) {
    console.error('Failed to get messages', error);
    return [];
  }
}

export async function markAsRead(customerId: string, messageId: string) {
  try {
    await apiMutate(`/team/conversations/${customerId}/read`, 'POST', { messageId });
  } catch (error) {
    console.error('Failed to mark as read', error);
  }
}

export async function sendMessage(customerId: string, body: string) {
  try {
    return await apiMutate<Message>('/team/conversations/messages', 'POST', {
      customerId,
      body,
    });
  } catch (error) {
    console.error('Failed to send message', error);
    throw error;
  }
}
