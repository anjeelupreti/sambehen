import type { ChatMessage } from './types';
import type { Message, StaffMessage } from '@/lib/types';

/**
 * A customer-thread message, seen from the staff side: every staff reply
 * sits on "our" side, labelled with who sent it when that was someone else,
 * so a manager reading a store's thread knows who answered.
 */
export function fromCustomerThreadForStaff(message: Message, viewerUsername: string): ChatMessage {
  const fromStaff = message.senderType === 'staff';
  const sender = message.senderStaffUsername ?? null;
  return {
    id: message.id,
    body: message.body,
    attachments: message.attachments ?? [],
    createdAt: message.createdAt,
    mine: fromStaff,
    senderLabel: fromStaff && sender && sender !== viewerUsername ? sender : null,
    status: 'sent',
  };
}

/** A customer-thread message, seen by the customer. The team is one voice. */
export function fromCustomerThreadForCustomer(message: Message): ChatMessage {
  return {
    id: message.id,
    body: message.body,
    attachments: message.attachments ?? [],
    createdAt: message.createdAt,
    mine: message.senderType === 'customer',
    status: 'sent',
  };
}

/** A staff-to-staff message. */
export function fromStaffThread(message: StaffMessage, viewerId: string): ChatMessage {
  return {
    id: message.id,
    body: message.body,
    attachments: message.attachments ?? [],
    createdAt: message.createdAt,
    mine: message.senderStaffId === viewerId,
    status: 'sent',
  };
}
