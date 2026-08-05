import { DrizzleDB } from '../database.provider';
import { games, transactions, customers } from '../schema';
import { eq, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { TransactionType } from '@common/constants/app.constants';

export async function seedGamesAndTransactions(db: DrizzleDB, seededCustomers: { id: string }[]) {
  // 1. Seed Games
  const gameData = [
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

  const insertedGames = await db.insert(games).values(gameData).onConflictDoNothing().returning();

  // 2. Seed Transactions for each customer
  const allGames = await db.select().from(games);

  for (const customer of seededCustomers) {
    // Generate 10-20 transactions for each customer
    const txCount = Math.floor(Math.random() * 11) + 10;
    const customerTransactions = [];

    let balance = 0;

    for (let i = 0; i < txCount; i++) {
      // spread over last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const occurredAt = subDays(new Date(), daysAgo);

      const type = Math.random() > 0.4 ? TransactionType.DEBIT : TransactionType.CREDIT;
      const amount = Math.floor(Math.random() * 1000) + 10;

      const game = allGames[Math.floor(Math.random() * allGames.length)];

      customerTransactions.push({
        customerId: customer.id,
        type: type,
        amount: amount.toString(),
        parentTransactionId: null,
        gameId: game.id,
        occurredAt,
        note: 'Seeded transaction',
        enteredByStaffId: (customer as any).createdByStaffId || (customer as any).managerId,
      });

      if (type === TransactionType.DEBIT) {
        balance += amount;
      } else {
        balance -= amount;
      }
    }

    // Sort by occurredAt so balance makes sense over time, though not strictly required for sum
    customerTransactions.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    if (customerTransactions.length > 0) {
      await db.insert(transactions).values(customerTransactions);

      // Update customer aggregates
      await db.execute(sql`
        UPDATE customers
        SET 
          balance = (SELECT COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END), 0) FROM transactions WHERE customer_id = customers.id AND parent_transaction_id IS NULL)
        WHERE id = ${customer.id}
      `);
    }
  }
}
