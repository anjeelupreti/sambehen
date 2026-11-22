import type { MessageAttachment } from '@/lib/types';

/**
 * One message as every chat surface renders it, whichever API it came
 * from (customer threads, staff threads).
 */
export interface ChatMessage {
  /** Server id once saved; a temporary id while sending. */
  id: string;
  body: string;
  attachments: MessageAttachment[];
  createdAt: string;
  /** Sent by the person looking at the screen. */
  mine: boolean;
  /** Shown above a group of someone else's messages, when it adds something. */
  senderLabel?: string | null;
  status: 'sending' | 'sent' | 'failed';
}

export interface ThreadPage {
  messages: ChatMessage[];
  nextCursor: string | null;
  /** How far the other side has read; my messages up to here show as read. */
  readAt: string | null;
}
