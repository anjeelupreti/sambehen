import { DrizzleDB } from './database.provider';

/**
 * Wraps a callback in a Drizzle transaction.
 * Usage:
 *   const result = await withTransaction(db, async (tx) => {
 *     await tx.insert(users).values({ ... });
 *     await tx.update(accounts).set({ ... }).where(...);
 *     return { success: true };
 *   });
 */
export async function withTransaction<T>(
  db: DrizzleDB,
  callback: (tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    return callback(tx);
  });
}
