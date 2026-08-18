import { sql } from 'drizzle-orm';
import { ConversationStatus, MessageSenderType } from '@common/constants/app.constants';
import { DrizzleDB } from '../database.provider';
import {
  conversations,
  messages,
  conversationReadStates,
  staffConversations,
  staffMessages,
  staffConversationReadStates,
  Customer,
} from '../schema';
import type { ISeededStaff } from './staff.seed';

const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

/** `chk_staff_conversations_canonical_order` requires the lexically smaller id first. */
const orderPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/**
 * A customer conversation, its messages, and (for some) a read state for
 * the owning staff member — so unread counts have real rows to compute
 * from rather than always being zero on a fresh seed.
 */
async function seedCustomerConversation(
  db: DrizzleDB,
  customer: Customer,
  staffId: string,
  script: { from: 'customer' | 'staff'; body: string; minutesAgo: number }[],
  markRead: boolean,
): Promise<void> {
  const [conversation] = await db
    .insert(conversations)
    .values({
      customerId: customer.id,
      assignedStaffId: staffId,
      status: ConversationStatus.OPEN,
    })
    .returning();

  let lastMessageAt: Date | null = null;
  let lastMessagePreview: string | null = null;
  let lastCustomerMessageAt: Date | null = null;
  let lastStaffMessageAt: Date | null = null;
  let lastMessageId: string | null = null;

  for (const line of script) {
    const createdAt = minutesAgo(line.minutesAgo);
    const [inserted] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderType: line.from === 'customer' ? MessageSenderType.CUSTOMER : MessageSenderType.STAFF,
        senderCustomerId: line.from === 'customer' ? customer.id : null,
        senderStaffId: line.from === 'staff' ? staffId : null,
        body: line.body,
        createdAt,
      })
      .returning({ id: messages.id });

    lastMessageAt = createdAt;
    lastMessagePreview = line.body.slice(0, 200);
    lastMessageId = inserted.id;
    if (line.from === 'customer') lastCustomerMessageAt = createdAt;
    else lastStaffMessageAt = createdAt;
  }

  await db
    .update(conversations)
    .set({
      lastMessageAt,
      lastMessagePreview,
      lastCustomerMessageAt,
      lastStaffMessageAt,
      messageCount: script.length,
    })
    .where(sql`${conversations.id} = ${conversation.id}`);

  // A read state pointing at the last message means "staff has seen
  // everything"; no row at all means "never opened" — both are real
  // states the inbox needs to render correctly.
  if (markRead && lastMessageId) {
    await db.insert(conversationReadStates).values({
      conversationId: conversation.id,
      staffId,
      lastReadMessageId: lastMessageId,
      lastReadAt: lastMessageAt ?? new Date(),
    });
  }
}

async function seedStaffThread(
  db: DrizzleDB,
  staffA: string,
  staffB: string,
  script: { from: string; body: string; minutesAgo: number }[],
  readBy?: string,
): Promise<void> {
  const [a, b] = orderPair(staffA, staffB);

  const [conversation] = await db
    .insert(staffConversations)
    .values({ staffAId: a, staffBId: b })
    .returning();

  let lastMessageAt: Date | null = null;
  let lastMessagePreview: string | null = null;
  let lastMessageId: string | null = null;

  for (const line of script) {
    const createdAt = minutesAgo(line.minutesAgo);
    const [inserted] = await db
      .insert(staffMessages)
      .values({
        conversationId: conversation.id,
        senderStaffId: line.from,
        body: line.body,
        createdAt,
      })
      .returning({ id: staffMessages.id });

    lastMessageAt = createdAt;
    lastMessagePreview = line.body.slice(0, 200);
    lastMessageId = inserted.id;
  }

  await db
    .update(staffConversations)
    .set({ lastMessageAt, lastMessagePreview, messageCount: script.length })
    .where(sql`${staffConversations.id} = ${conversation.id}`);

  if (readBy && lastMessageId) {
    await db.insert(staffConversationReadStates).values({
      conversationId: conversation.id,
      staffId: readBy,
      lastReadMessageId: lastMessageId,
      lastReadAt: lastMessageAt ?? new Date(),
    });
  }
}

/**
 * Customer conversations and staff DMs, in a mix of read and unread
 * states, so the messaging inbox — both sides — has something to show on
 * a fresh seed instead of an empty list.
 *
 * Idempotent by clearing the tables it owns and rebuilding, same
 * reasoning as `engagement.seed.ts` and `referrals.seed.ts`: nothing else
 * writes to these tables at seed time, and a conversation is one cohesive
 * script (who said what, in what order) that cannot sensibly be
 * "topped up" without either duplicating messages or hand-merging two
 * independent threads.
 */
export async function seedMessaging(
  db: DrizzleDB,
  staff: ISeededStaff,
  customers: Customer[],
): Promise<{ customerThreads: number; staffThreads: number }> {
  await db.execute(sql`DELETE FROM conversation_read_states`);
  await db.execute(sql`DELETE FROM messages`);
  await db.execute(sql`DELETE FROM conversations`);
  await db.execute(sql`DELETE FROM staff_conversation_read_states`);
  await db.execute(sql`DELETE FROM staff_messages`);
  await db.execute(sql`DELETE FROM staff_conversations`);

  const storeOwned = customers.filter((c) => c.storeId);
  let customerThreads = 0;

  if (storeOwned[0]) {
    await seedCustomerConversation(
      db,
      storeOwned[0],
      storeOwned[0].storeId as string,
      [
        {
          from: 'customer',
          body: 'Hi, my last deposit hasn’t shown up in my balance yet.',
          minutesAgo: 180,
        },
        { from: 'staff', body: 'Checking now — can you confirm the amount?', minutesAgo: 175 },
        { from: 'customer', body: 'It was 200.', minutesAgo: 170 },
        { from: 'staff', body: 'Found it, applied now. Sorry for the wait!', minutesAgo: 165 },
      ],
      true,
    );
    customerThreads += 1;
  }

  if (storeOwned[1]) {
    // Deliberately left unread — the newest message is from the customer
    // and nobody has a read state yet, which is exactly the "awaiting
    // reply" case the inbox filter exists to surface.
    await seedCustomerConversation(
      db,
      storeOwned[1],
      storeOwned[1].storeId as string,
      [{ from: 'customer', body: 'Is there a spin event running this week?', minutesAgo: 20 }],
      false,
    );
    customerThreads += 1;
  }

  if (storeOwned[2]) {
    await seedCustomerConversation(
      db,
      storeOwned[2],
      storeOwned[2].storeId as string,
      [
        { from: 'customer', body: 'Can I get my referral link?', minutesAgo: 1440 },
        {
          from: 'staff',
          body: 'Sure — check your dashboard, it’s under Referrals.',
          minutesAgo: 1430,
        },
        { from: 'customer', body: 'Got it, thank you!', minutesAgo: 1420 },
      ],
      true,
    );
    customerThreads += 1;
  }

  let staffThreads = 0;
  const manager = staff.managers[0];
  const store = staff.stores[0];
  const secondStore = staff.stores[1];

  if (manager && store) {
    await seedStaffThread(
      db,
      manager.id,
      store.id,
      [
        {
          from: store.id,
          body: 'A customer is asking about withdrawal timing, can you confirm our current turnaround?',
          minutesAgo: 90,
        },
        {
          from: manager.id,
          body: 'Same day if requested before 5pm, next morning otherwise.',
          minutesAgo: 85,
        },
      ],
      manager.id,
    );
    staffThreads += 1;
  }

  if (manager && secondStore) {
    // Left unread from the manager's side.
    await seedStaffThread(db, manager.id, secondStore.id, [
      {
        from: secondStore.id,
        body: 'Heads up — I approved a reassignment for customer12 per your note.',
        minutesAgo: 30,
      },
    ]);
    staffThreads += 1;
  }

  if (manager) {
    await seedStaffThread(
      db,
      staff.master.id,
      manager.id,
      [
        {
          from: staff.master.id,
          body: 'Reminder: quarterly VIP recompute runs tonight.',
          minutesAgo: 600,
        },
        { from: manager.id, body: 'Noted, thanks.', minutesAgo: 590 },
      ],
      manager.id,
    );
    staffThreads += 1;
  }

  return { customerThreads, staffThreads };
}
