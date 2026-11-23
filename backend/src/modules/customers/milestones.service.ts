import { Inject, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { asc, eq, min } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { messages } from '@database/schema/messaging.schema';
import { referrals } from '@database/schema/referrals.schema';
import { transactions } from '@database/schema/transactions.schema';
import { vipQualifications } from '@database/schema/vip-qualifications.schema';
import { ErrorCode } from '@common/constants/error-codes';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';

/**
 * The milestones a player can earn. Every one is about being part of the
 * community (joining, talking, bringing friends, sticking around), never
 * about how much money moves. Spend-based rewards would turn the portal
 * into a deposit nudge, which is the opposite of what operators need.
 */
export const MILESTONE_KEYS = [
  'joined',
  'first_message',
  'first_referral',
  'five_referrals',
  'vip',
  'three_months',
  'six_months',
  'one_year',
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export class MilestoneDto {
  @ApiProperty({ enum: MILESTONE_KEYS })
  key!: MilestoneKey;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  achievedAt!: Date | null;

  @ApiProperty({ description: 'Progress so far, for milestones that count something.' })
  current!: number;

  @ApiProperty({ description: 'What completes the milestone.' })
  target!: number;
}

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

@Injectable()
export class MilestonesService {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  async forCustomer(customerId: string): Promise<MilestoneDto[]> {
    const [customer] = await this.db
      .select({ createdAt: customers.createdAt })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }

    const [[firstMessage], referred, [firstVip], [firstEntry]] = await Promise.all([
      this.db
        .select({ at: min(messages.createdAt) })
        .from(messages)
        .where(eq(messages.senderCustomerId, customerId)),
      this.db
        .select({ at: referrals.createdAt })
        .from(referrals)
        .where(eq(referrals.referrerCustomerId, customerId))
        .orderBy(asc(referrals.createdAt))
        .limit(5),
      this.db
        .select({ at: min(vipQualifications.qualifiedAt) })
        .from(vipQualifications)
        .where(eq(vipQualifications.customerId, customerId)),
      this.db
        .select({ at: min(transactions.occurredAt) })
        .from(transactions)
        .where(eq(transactions.customerId, customerId)),
    ]);

    const asDate = (value: Date | string | null | undefined) => (value ? new Date(value) : null);
    const now = new Date();
    // The earliest sign of the player, not just the account row: players
    // imported from another system have history older than their record.
    const joined = new Date(
      Math.min(
        ...[customer.createdAt, asDate(firstEntry?.at), asDate(firstMessage?.at), referred[0]?.at]
          .filter((d): d is Date => d instanceof Date)
          .map((d) => d.getTime()),
      ),
    );
    const monthsIn = Math.max(
      0,
      (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth(),
    );
    const anniversary = (months: number): MilestoneDto => {
      const due = addMonths(joined, months);
      return {
        key: months === 3 ? 'three_months' : months === 6 ? 'six_months' : 'one_year',
        achievedAt: due <= now ? due : null,
        current: Math.min(monthsIn, months),
        target: months,
      };
    };
    return [
      { key: 'joined', achievedAt: joined, current: 1, target: 1 },
      {
        key: 'first_message',
        achievedAt: asDate(firstMessage?.at),
        current: firstMessage?.at ? 1 : 0,
        target: 1,
      },
      {
        key: 'first_referral',
        achievedAt: referred[0]?.at ?? null,
        current: Math.min(referred.length, 1),
        target: 1,
      },
      {
        key: 'five_referrals',
        achievedAt: referred[4]?.at ?? null,
        current: referred.length,
        target: 5,
      },
      { key: 'vip', achievedAt: asDate(firstVip?.at), current: firstVip?.at ? 1 : 0, target: 1 },
      anniversary(3),
      anniversary(6),
      anniversary(12),
    ];
  }
}
