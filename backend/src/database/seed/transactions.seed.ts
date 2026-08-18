import { inArray, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { TransactionType } from '@common/constants/app.constants';
import { DrizzleDB } from '../database.provider';
import { games, transactions, Customer } from '../schema';

const GAMES = [
  {
    code: 'SLOT-001',
    name: 'Mega Fortune',
    category: 'slots',
    isActive: true,
    description: 'Popular slot game',
  },
  {
    code: 'SLOT-002',
    name: 'Starburst',
    category: 'slots',
    isActive: true,
    description: 'Classic slot',
  },
  {
    code: 'TABL-001',
    name: 'Blackjack Pro',
    category: 'table',
    isActive: true,
    description: 'Table game',
  },
  {
    code: 'LIVE-001',
    name: 'Live Roulette',
    category: 'live',
    isActive: true,
    description: 'Live dealer',
  },
];

/**
 * A tiny deterministic PRNG (mulberry32), seeded per customer.
 *
 * `Math.random()` would make every reseed generate a different transaction
 * history for the same customer, which defeats the point of a seed being
 * reproducible — screenshots, bug reports and "as store11, look at
 * customer3's history" instructions would all go stale on the next
 * `db:seed`.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFromString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
};

/**
 * Seeds the game catalogue and a transaction history per customer.
 *
 * Idempotent by clearing and rebuilding each seeded customer's
 * transactions rather than checking row-by-row: a transaction history is
 * one cohesive story (opening balance, a spread of activity, a current
 * balance that agrees with it), and there is no sensible way to
 * "top up" an existing partial one without either duplicating entries or
 * hand-merging two random walks. Clear-and-rebuild is what `engagement.
 * seed.ts` already does for the same reason.
 */
export async function seedGamesAndTransactions(
  db: DrizzleDB,
  seededCustomers: Customer[],
): Promise<void> {
  await db.insert(games).values(GAMES).onConflictDoNothing();
  const allGames = await db.select().from(games);

  const customerIds = seededCustomers.map((c) => c.id);
  if (customerIds.length > 0) {
    await db.delete(transactions).where(inArray(transactions.customerId, customerIds));
  }

  for (const customer of seededCustomers) {
    const random = mulberry32(seedFromString(customer.id));

    // 10-25 transactions per customer, spread over the last 90 days, so
    // trend charts have enough history to show a real shape rather than a
    // flat line.
    const txCount = Math.floor(random() * 16) + 10;
    const rows: (typeof transactions.$inferInsert)[] = [];

    // Never null in practice: only store- and manager-owned customers ever
    // reach this seeder (pending self-registrations are excluded before
    // this is called), and both shapes carry at least one of these.
    const enteredBy = (customer.storeId ?? customer.managerId ?? customer.ownerStaffId) as string;

    for (let i = 0; i < txCount; i += 1) {
      const daysAgo = Math.floor(random() * 90);
      const occurredAt = subDays(new Date(), daysAgo);

      // Debits (money in) outnumber credits (money out) roughly 3:2, so
      // most customers end up with a positive balance rather than a
      // coin-flip between wildly positive and negative.
      const type = random() > 0.4 ? TransactionType.DEBIT : TransactionType.CREDIT;
      const amount = (Math.floor(random() * 990) + 10).toFixed(2);
      const game = allGames[Math.floor(random() * allGames.length)];

      rows.push({
        customerId: customer.id,
        type,
        amount,
        parentTransactionId: null,
        gameId: game.id,
        occurredAt,
        note: 'Seeded transaction',
        enteredByStaffId: enteredBy,
      });
    }

    if (rows.length === 0) continue;

    await db.insert(transactions).values(rows);

    // The customer's stored balance is a running total maintained by
    // `TransactionsService.create`, not derived on read — recompute it
    // here the same way, since the seed bypasses that service.
    await db.execute(sql`
      UPDATE customers
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END), 0)
        FROM transactions
        WHERE customer_id = customers.id AND parent_transaction_id IS NULL
      )
      WHERE id = ${customer.id}
    `);
  }
}
