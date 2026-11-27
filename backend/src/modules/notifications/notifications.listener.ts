import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { MessageSenderType, StaffRole, TransactionType } from '@common/constants/app.constants';
import {
  CAMPAIGN_FINISHED,
  CampaignFinishedEvent,
  CUSTOMER_APPROVED,
  CUSTOMER_REGISTERED,
  CustomerApprovedEvent,
  CustomerRegisteredEvent,
  REFERRAL_REWARDED,
  ReferralRewardedEvent,
  VIP_TIER_REACHED,
  VipTierReachedEvent,
} from '@common/events/domain-events';
import { Money } from '@common/utils/money.util';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { games } from '@database/schema/games.schema';
import { conversations } from '@database/schema/messaging.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { transactions } from '@database/schema/transactions.schema';
import { MESSAGE_CREATED, MessageCreatedEvent } from '@modules/messaging/messaging.service';
import {
  STAFF_MESSAGE_CREATED,
  StaffMessageCreatedEvent,
} from '@modules/messaging/staff-messaging.service';
import {
  TRANSACTION_CREATED,
  TransactionCreatedEvent,
} from '@modules/transactions/transactions.service';
import {
  PlayerNotificationKind as Player,
  StaffNotificationKind as Staff,
  WAITING_NUDGE_MINUTES,
} from './notification-kinds';
import { NotificationsService } from './notifications.service';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (value: string | number) => dollars.format(Number(value));

/** A message's text as a one-line preview. */
function preview(body: string, attachments?: unknown[] | null): string {
  const text = body.trim().replace(/\s+/g, ' ');
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  const count = attachments?.length ?? 0;
  return count === 1 ? 'Sent an attachment' : count > 1 ? `Sent ${count} attachments` : '';
}

/**
 * Turns things that happen in the app into notifications for the people
 * who need to know. Each handler is fire-and-forget: a notification that
 * fails is logged by the service and never affects the action behind it.
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly notifications: NotificationsService,
  ) {}

  private async customerName(customerId: string): Promise<string> {
    const [row] = await this.db
      .select({ fullName: customers.fullName, username: customers.username })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    return row?.fullName || row?.username || 'A player';
  }

  // ── Messages ───────────────────────────────────────────────────

  @OnEvent(MESSAGE_CREATED, { async: true })
  async onMessage(event: MessageCreatedEvent): Promise<void> {
    const { message } = event;
    const text = preview(message.body, message.attachments);

    if (message.senderType === MessageSenderType.CUSTOMER) {
      // Whoever looks after the player: their store, or their manager.
      const owner = event.storeId ?? event.managerId;
      if (!owner) return;
      await this.notifications.notify({
        realm: 'team',
        recipientIds: [owner],
        kind: Staff.PLAYER_MESSAGE,
        title: await this.customerName(event.customerId),
        body: text,
        link: '/messages',
        data: { conversationId: event.conversationId, tag: `conv-${event.conversationId}` },
      });
      return;
    }

    if (message.senderType === MessageSenderType.STAFF) {
      await this.notifications.notify({
        realm: 'customer',
        recipientIds: [event.customerId],
        kind: Player.TEAM_REPLY,
        title: 'Your team replied',
        body: text,
        link: '/customer/messages',
        data: { tag: 'team-reply' },
      });
    }
  }

  @OnEvent(STAFF_MESSAGE_CREATED, { async: true })
  async onStaffMessage(event: StaffMessageCreatedEvent): Promise<void> {
    const { message } = event;
    const [sender] = await this.db
      .select({ firstName: staffUsers.firstName, lastName: staffUsers.lastName })
      .from(staffUsers)
      .where(eq(staffUsers.id, message.senderStaffId))
      .limit(1);
    const name =
      [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || message.senderUsername;
    await this.notifications.notify({
      realm: 'team',
      recipientIds: event.participantIds.filter((id) => id !== message.senderStaffId),
      kind: Staff.TEAM_MESSAGE,
      title: name,
      body: preview(message.body, message.attachments),
      link: '/messages',
      data: { tag: `staff-${message.conversationId}` },
    });
  }

  private async activeMasters(): Promise<string[]> {
    const rows = await this.db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(and(eq(staffUsers.role, StaffRole.MASTER), eq(staffUsers.isActive, true)));
    return rows.map((row) => row.id);
  }

  /**
   * Nudges the player's store (or manager) and every master when a player
   * has waited too long. Once per wait: a player who writes again after a
   * reply starts a new wait.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'notify-waiting-players' })
  async nudgeWaiting(): Promise<void> {
    try {
      const rows = await this.db
        .select({
          conversationId: conversations.id,
          customerId: conversations.customerId,
          waitingSince: conversations.lastCustomerMessageAt,
          storeId: customers.storeId,
          managerId: customers.managerId,
          name: sql<string>`COALESCE(${customers.fullName}, ${customers.username})`,
        })
        .from(conversations)
        .innerJoin(customers, eq(customers.id, conversations.customerId))
        .where(
          and(
            isNull(customers.deletedAt),
            sql`${conversations.lastCustomerMessageAt} IS NOT NULL`,
            sql`(${conversations.lastStaffMessageAt} IS NULL
                 OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt})`,
            sql`${conversations.lastCustomerMessageAt} <= now() - make_interval(mins => ${WAITING_NUDGE_MINUTES})`,
            sql`${conversations.lastCustomerMessageAt} > now() - interval '1 day'`,
          ),
        );
      if (!rows.length) return;
      const masters = await this.activeMasters();

      for (const row of rows) {
        const owner = row.storeId ?? row.managerId;
        if (!row.waitingSince) continue;
        const already = await this.notifications.sentSince(
          'team',
          Staff.PLAYER_WAITING,
          'conversationId',
          row.conversationId,
          row.waitingSince,
        );
        if (already) continue;
        await this.notifications.notify({
          realm: 'team',
          recipientIds: owner ? [owner, ...masters] : masters,
          kind: Staff.PLAYER_WAITING,
          title: `${row.name} is waiting`,
          body: `No reply for ${WAITING_NUDGE_MINUTES} minutes.`,
          link: '/messages',
          data: { conversationId: row.conversationId, tag: `wait-${row.conversationId}` },
        });
      }
    } catch (error) {
      this.logger.error(
        'Waiting nudge failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Players and money ──────────────────────────────────────────

  @OnEvent(TRANSACTION_CREATED, { async: true })
  async onTransaction(event: TransactionCreatedEvent): Promise<void> {
    if (event.isCorrection) return;
    const [row] = await this.db
      .select({ balance: customers.balance, game: games.name })
      .from(transactions)
      .innerJoin(customers, eq(customers.id, transactions.customerId))
      .leftJoin(games, eq(games.id, transactions.gameId))
      .where(eq(transactions.id, event.transactionId))
      .limit(1);
    const moneyIn = event.type === TransactionType.DEBIT;
    const amount = `${moneyIn ? '+' : '−'}${money(event.amount)}`;
    await this.notifications.notify({
      realm: 'customer',
      recipientIds: [event.customerId],
      kind: Player.VISIT_RECORDED,
      title: moneyIn ? 'Visit recorded' : 'Money out recorded',
      body: `${amount}${row?.game ? ` on ${row.game}` : ''}. Balance ${money(row?.balance ?? 0)}.`,
      link: '/customer',
    });
  }

  @OnEvent(VIP_TIER_REACHED, { async: true })
  async onVipTier(event: VipTierReachedEvent): Promise<void> {
    const tier = event.criteriaName.split(/\s[—–-]\s/)[0].trim();
    await this.notifications.notify({
      realm: 'customer',
      recipientIds: [event.customerId],
      kind: Player.VIP_TIER,
      title: `You reached ${tier}`,
      body: 'Your new VIP tier is live.',
      link: '/customer',
    });
  }

  @OnEvent(REFERRAL_REWARDED, { async: true })
  async onReferral(event: ReferralRewardedEvent): Promise<void> {
    const friend = await this.customerName(event.refereeCustomerId);
    const bonus = Money.isPositive(event.referrerReward)
      ? `${money(event.referrerReward)} bonus`
      : null;
    await this.notifications.notify({
      realm: 'customer',
      recipientIds: [event.referrerCustomerId],
      kind: Player.REFERRAL_BONUS,
      title: `${friend} joined with your invite`,
      body: bonus ? `${bonus} added to your account.` : null,
      link: '/customer',
    });
    if (Money.isPositive(event.refereeReward)) {
      await this.notifications.notify({
        realm: 'customer',
        recipientIds: [event.refereeCustomerId],
        kind: Player.REFERRAL_BONUS,
        title: 'Your welcome bonus is in',
        body: `${money(event.refereeReward)} bonus added for joining with an invite.`,
        link: '/customer',
      });
    }
  }

  @OnEvent(CUSTOMER_APPROVED, { async: true })
  async onApproved(event: CustomerApprovedEvent): Promise<void> {
    await this.notifications.notify({
      realm: 'customer',
      recipientIds: [event.customerId],
      kind: Player.ACCOUNT_APPROVED,
      title: 'Your account is approved',
      body: 'Welcome in. Say howdy to your store any time.',
      link: '/customer',
    });
  }

  /** Time with the store, checked once a day: 3 months, 6 months, a year. */
  @Cron('0 15 * * *', { name: 'notify-anniversaries' })
  async anniversaries(): Promise<void> {
    try {
      for (const [months, label] of [
        [3, 'three months'],
        [6, 'six months'],
        [12, 'one year'],
      ] as const) {
        const rows = await this.db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              isNull(customers.deletedAt),
              sql`(${customers.registeredAt} + make_interval(months => ${months}))::date = CURRENT_DATE`,
            ),
          );
        if (!rows.length) continue;
        await this.notifications.notify({
          realm: 'customer',
          recipientIds: rows.map((row) => row.id),
          kind: Player.MILESTONE,
          title: `Milestone: ${label} with your store`,
          body: 'A new medal is on your overview.',
          link: '/customer',
        });
      }
      await this.notifications.prune();
    } catch (error) {
      this.logger.error(
        'Anniversary notifications failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ── Staff work ─────────────────────────────────────────────────

  @OnEvent(CUSTOMER_REGISTERED, { async: true })
  async onRegistered(event: CustomerRegisteredEvent): Promise<void> {
    await this.notifications.notify({
      realm: 'team',
      recipientIds: await this.activeMasters(),
      kind: Staff.REGISTRATION,
      title: 'New registration to approve',
      body: event.name,
      link: '/customers?status=pending',
    });
  }

  @OnEvent(CAMPAIGN_FINISHED, { async: true })
  async onCampaignFinished(event: CampaignFinishedEvent): Promise<void> {
    if (!event.createdByStaffId) return;
    const failed = event.status === 'failed';
    await this.notifications.notify({
      realm: 'team',
      recipientIds: [event.createdByStaffId],
      kind: Staff.BROADCAST_DONE,
      title: failed ? `Broadcast failed: ${event.subject}` : `Broadcast sent: ${event.subject}`,
      body: `${event.sentCount} delivered${event.failedCount ? `, ${event.failedCount} failed` : ''}.`,
      link: '/broadcast',
    });
  }
}
