import { sql } from 'drizzle-orm';
import {
  BonusDirection,
  ReferralRewardType,
  ReferralStatus,
} from '@common/constants/app.constants';
import { DrizzleDB } from '../database.provider';
import { referralPrograms, referralCodes, referrals, bonusLedger, Customer } from '../schema';

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Referral programs, issued codes, and referrals across all four statuses.
 *
 * Idempotent like `engagement.seed.ts`: clears the tables it owns and
 * rebuilds from scratch, rather than checking row-by-row. There is
 * nothing else writing to these tables at seed time, so full ownership is
 * a safe assumption here the way it is for VIP criteria and spin events.
 */
export async function seedReferrals(
  db: DrizzleDB,
  masterId: string,
  customers: Customer[],
): Promise<{ programs: number; codes: number; referrals: number }> {
  await db.execute(sql`DELETE FROM bonus_ledger`);
  await db.execute(sql`DELETE FROM referrals`);
  await db.execute(sql`DELETE FROM referral_codes`);
  await db.execute(sql`DELETE FROM referral_programs`);

  if (customers.length < 14) {
    // Too few seeded customers to build the four referral relationships
    // below without a referrer and referee colliding. Not expected in
    // practice — the customer seeder produces dozens — but fail soft
    // rather than crash the whole seed transaction over demo data.
    return { programs: 0, codes: 0, referrals: 0 };
  }

  const [standardProgram, closedProgram] = await db
    .insert(referralPrograms)
    .values([
      {
        name: 'Bring a Friend',
        description: 'Standard ongoing referral reward.',
        rewardType: ReferralRewardType.FIXED,
        referrerBonus: '50.00',
        refereeBonus: '25.00',
        minQualifyingDebit: '100.00',
        validFrom: isoDate(daysAgo(90)),
        validTo: null,
        isActive: true,
        createdByStaffId: masterId,
      },
      {
        // Kept deliberately, same reasoning as the closed VIP criteria:
        // past referrals paid under it must stay visible, not vanish
        // because the program that granted them is no longer running.
        name: 'Summer Boost (closed)',
        description: 'A limited-time percentage bonus, no longer running.',
        rewardType: ReferralRewardType.PERCENTAGE,
        referrerBonus: '10.00',
        refereeBonus: '5.00',
        minQualifyingDebit: '50.00',
        validFrom: isoDate(daysAgo(200)),
        validTo: isoDate(daysAgo(30)),
        isActive: false,
        createdByStaffId: masterId,
      },
    ])
    .returning();

  const referrerA = customers[0];
  const referrerB = customers[1];

  const [codeA, codeB] = await db
    .insert(referralCodes)
    .values([
      {
        customerId: referrerA.id,
        programId: standardProgram.id,
        code: 'FRIEND01',
        linkSlug: 'friend-01',
        assignedByStaffId: masterId,
      },
      {
        customerId: referrerB.id,
        programId: standardProgram.id,
        code: 'FRIEND02',
        linkSlug: 'friend-02',
        assignedByStaffId: masterId,
      },
    ])
    .returning();

  const refereePending = customers[10];
  const refereeQualified = customers[11];
  const refereeRewarded = customers[12];
  const refereeRejected = customers[13];

  const [, , rewardedReferral] = await db
    .insert(referrals)
    .values([
      {
        codeId: codeA.id,
        programId: standardProgram.id,
        referrerCustomerId: referrerA.id,
        refereeCustomerId: refereePending.id,
        status: ReferralStatus.PENDING,
        createdAt: daysAgo(2),
      },
      {
        codeId: codeA.id,
        programId: standardProgram.id,
        referrerCustomerId: referrerA.id,
        refereeCustomerId: refereeQualified.id,
        status: ReferralStatus.QUALIFIED,
        qualifiedAt: daysAgo(3),
        createdAt: daysAgo(10),
      },
      {
        codeId: codeB.id,
        programId: standardProgram.id,
        referrerCustomerId: referrerB.id,
        refereeCustomerId: refereeRewarded.id,
        status: ReferralStatus.REWARDED,
        referrerReward: standardProgram.referrerBonus,
        refereeReward: standardProgram.refereeBonus,
        qualifiedAt: daysAgo(20),
        rewardedAt: daysAgo(19),
        createdAt: daysAgo(25),
      },
      {
        codeId: codeB.id,
        programId: standardProgram.id,
        referrerCustomerId: referrerB.id,
        refereeCustomerId: refereeRejected.id,
        status: ReferralStatus.REJECTED,
        rejectedReason: 'Referee account was suspended before qualifying.',
        createdAt: daysAgo(15),
      },
    ])
    .returning();

  await db
    .update(referralCodes)
    .set({ usageCount: 2 })
    .where(sql`${referralCodes.id} IN (${codeA.id}, ${codeB.id})`);

  // The rewarded referral is the only one that actually pays out — bonus
  // money is real balance, so only a settled referral earns it.
  await db.insert(bonusLedger).values([
    {
      customerId: referrerB.id,
      referralId: rewardedReferral.id,
      direction: BonusDirection.CREDIT,
      amount: standardProgram.referrerBonus,
      reason: 'referral_referrer',
      note: `Referral reward for bringing in ${refereeRewarded.username}`,
      createdByStaffId: masterId,
    },
    {
      customerId: refereeRewarded.id,
      referralId: rewardedReferral.id,
      direction: BonusDirection.CREDIT,
      amount: standardProgram.refereeBonus,
      reason: 'referral_referee',
      note: 'Welcome bonus for joining through a referral',
      createdByStaffId: masterId,
    },
  ]);

  for (const customerId of [referrerB.id, refereeRewarded.id]) {
    await db.execute(sql`
      UPDATE customers
      SET bonus_balance = (
        SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)
        FROM bonus_ledger
        WHERE customer_id = customers.id
      )
      WHERE id = ${customerId}
    `);
  }

  return { programs: 2, codes: 2, referrals: 4 };
}
