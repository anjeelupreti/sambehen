import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import {
  BonusDirection,
  ReferralStatus,
  ReferralRewardType,
  TransactionType,
} from '@common/constants/app.constants';
import { Money } from '@common/utils/money.util';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { referrals, referralPrograms, bonusLedger } from '@database/schema/referrals.schema';
import { customers } from '@database/schema/customers.schema';
import { transactions } from '@database/schema/transactions.schema';
import {
  TRANSACTION_CREATED,
  TransactionCreatedEvent,
} from '@modules/transactions/transactions.service';

/**
 * Decides when a referral has earned its reward, and pays it out once.
 *
 * The hard requirement is idempotency. This runs on every transaction, and
 * a retry, a duplicated event or two concurrent deposits must never pay a
 * bonus twice. Two things guarantee that:
 *
 *   1. the status transition to `rewarded` is a conditional UPDATE that
 *      only matches a row still in `qualified`, so exactly one caller wins
 *   2. bonus_ledger has a unique index on (referral_id, reason), so even
 *      if two callers somehow got past step 1, the second insert conflicts
 *
 * Belt and braces, because paying a bonus twice is money out of the door
 * and is not detectable after the fact without reconciling by hand.
 */
@Injectable()
export class ReferralRewardService {
  private readonly logger = new Logger(ReferralRewardService.name);

  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  /**
   * Re-evaluates the referral a customer arrived through, if any.
   *
   * Called after each transaction: a referee's deposit is what moves the
   * referral from pending to qualified, and then to rewarded.
   */
  async evaluateForCustomer(refereeCustomerId: string): Promise<'none' | 'pending' | 'rewarded'> {
    const [row] = await this.db
      .select({ referral: referrals, program: referralPrograms })
      .from(referrals)
      .innerJoin(referralPrograms, eq(referrals.programId, referralPrograms.id))
      .where(eq(referrals.refereeCustomerId, refereeCustomerId))
      .limit(1);

    if (!row) return 'none';

    const { referral, program } = row;

    // Already settled, or deliberately rejected. Nothing further to do.
    if (
      referral.status === ReferralStatus.REWARDED ||
      referral.status === ReferralStatus.REJECTED
    ) {
      return 'none';
    }

    // Only debits count towards the threshold: money the referee actually
    // put in. A credit paid back out must not keep them qualified.
    const [totals] = await this.db
      .select({
        qualifyingDebit: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = ${TransactionType.DEBIT}
        ), 0)::text`,
      })
      .from(transactions)
      .where(and(eq(transactions.customerId, refereeCustomerId), isNull(transactions.deletedAt)));

    const deposited = totals?.qualifyingDebit ?? '0';

    if (Money.compare(deposited, program.minQualifyingDebit) < 0) {
      return 'pending';
    }

    if (!(await this.programIsValid(program.id))) {
      await this.reject(referral.id, 'Program expired before the referral qualified');
      return 'none';
    }

    if (
      !(await this.underRewardCap(
        referral.referrerCustomerId,
        program.id,
        program.maxRewardsPerReferrer,
      ))
    ) {
      await this.reject(referral.id, 'Referrer has reached the reward cap for this program');
      return 'none';
    }

    return (await this.grantReward(referral.id, program, deposited)) ? 'rewarded' : 'none';
  }

  /**
   * Pays both sides of a referral, exactly once.
   *
   * The conditional UPDATE is the gate: it flips qualified -> rewarded and
   * returns a row only for the caller that actually made the transition.
   * Everyone else sees zero rows and does nothing.
   */
  private async grantReward(
    referralId: string,
    program: typeof referralPrograms.$inferSelect,
    depositedAmount: string,
  ): Promise<boolean> {
    const referrerReward = this.rewardAmount(
      program.referrerBonus,
      program.rewardType,
      depositedAmount,
    );
    const refereeReward = this.rewardAmount(
      program.refereeBonus,
      program.rewardType,
      depositedAmount,
    );

    return this.db.transaction(async (tx) => {
      const claimed = await tx
        .update(referrals)
        .set({
          status: ReferralStatus.REWARDED,
          referrerReward,
          refereeReward,
          qualifiedAt: sql`COALESCE(${referrals.qualifiedAt}, NOW())`,
          rewardedAt: new Date(),
        })
        .where(
          and(
            eq(referrals.id, referralId),
            // Only a referral not yet rewarded can be claimed. This is what
            // makes concurrent callers safe.
            sql`${referrals.status} IN (${ReferralStatus.PENDING}, ${ReferralStatus.QUALIFIED})`,
          ),
        )
        .returning();

      if (claimed.length === 0) {
        // Someone else already paid this one.
        return false;
      }

      const referral = claimed[0];

      const entries = [
        {
          customerId: referral.referrerCustomerId,
          amount: referrerReward,
          reason: 'referral_referrer',
        },
        {
          customerId: referral.refereeCustomerId,
          amount: refereeReward,
          reason: 'referral_referee',
        },
      ].filter((entry) => Money.isPositive(entry.amount));

      for (const entry of entries) {
        await tx.insert(bonusLedger).values({
          customerId: entry.customerId,
          referralId: referral.id,
          direction: BonusDirection.CREDIT,
          amount: entry.amount,
          reason: entry.reason,
          note: `Referral reward under program "${program.name}"`,
        });

        // Bonus balance is separate from `balance`, which tracks real
        // money only.
        await tx
          .update(customers)
          .set({ bonusBalance: sql`${customers.bonusBalance} + ${entry.amount}` })
          .where(eq(customers.id, entry.customerId));
      }

      this.logger.log(
        `Referral ${referral.id} rewarded: referrer ${referrerReward}, referee ${refereeReward}`,
      );
      return true;
    });
  }

  /**
   * A percentage reward is a share of what the referee deposited; a fixed
   * reward is the configured amount regardless.
   */
  private rewardAmount(
    configured: string,
    rewardType: ReferralRewardType,
    depositedAmount: string,
  ): string {
    if (rewardType === ReferralRewardType.FIXED) return Money.normalise(configured);

    const percent = Number(configured);
    const deposited = Number(depositedAmount);
    return Money.normalise(((deposited * percent) / 100).toFixed(2));
  }

  private async programIsValid(programId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: referralPrograms.id })
      .from(referralPrograms)
      .where(
        and(
          eq(referralPrograms.id, programId),
          eq(referralPrograms.isActive, true),
          isNull(referralPrograms.deletedAt),
          sql`${referralPrograms.validFrom} <= CURRENT_DATE`,
          sql`(${referralPrograms.validTo} IS NULL OR ${referralPrograms.validTo} >= CURRENT_DATE)`,
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  private async underRewardCap(
    referrerCustomerId: string,
    programId: string,
    cap: number | null,
  ): Promise<boolean> {
    if (cap === null) return true;

    const [row] = await this.db
      .select({ value: count() })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerCustomerId, referrerCustomerId),
          eq(referrals.programId, programId),
          eq(referrals.status, ReferralStatus.REWARDED),
        ),
      );

    return Number(row?.value ?? 0) < cap;
  }

  private async reject(referralId: string, reason: string): Promise<void> {
    await this.db
      .update(referrals)
      .set({ status: ReferralStatus.REJECTED, rejectedReason: reason })
      .where(and(eq(referrals.id, referralId), sql`${referrals.status} <> 'rewarded'`));
  }

  /**
   * Reacts to new transactions.
   *
   * Errors are swallowed for the same reason as VIP recalculation: bonus
   * accounting must never fail the data entry staff just performed. A
   * failure leaves the referral pending, and the next transaction — or a
   * manual re-evaluation — settles it.
   */
  @OnEvent(TRANSACTION_CREATED, { async: true })
  async handleTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    // A correction reduces what the referee effectively deposited, so it
    // must not be the thing that tips them over the threshold.
    if (event.isCorrection) return;

    try {
      await this.evaluateForCustomer(event.customerId);
    } catch (error) {
      this.logger.error(
        `Failed to evaluate referral reward for customer ${event.customerId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
