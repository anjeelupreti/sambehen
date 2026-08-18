import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
import { DrizzleDB } from '../database.provider';
import { seedStaff, SEED_PASSWORD } from './staff.seed';
import { seedCustomers } from './customer.seed';
import { seedGamesAndTransactions } from './transactions.seed';
import { seedEngagement } from './engagement.seed';

/**
 * Database seed store — `npm run db:seed`.
 *
 * Seeders run in dependency order and must be idempotent, so the command
 * can be re-run against an existing database without duplicating rows.
 *
 * Phase 1 registers the staff/customer seeders; the store is wired up
 * ahead of them so the entrypoint and its transaction handling stay stable.
 */
async function main(): Promise<void> {
  const logger = console;
  logger.log('Starting database seed...');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sambehen',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  try {
    // A single transaction wraps every seeder, so a partial failure never
    // leaves the database half-populated.
    await db.transaction(async (tx) => {
      const staff = await seedStaff(tx as unknown as DrizzleDB);
      logger.log(
        `  staff: 1 master, ${staff.managers.length} managers, ${staff.stores.length} stores`,
      );

      const seededCustomers = await seedCustomers(tx as unknown as DrizzleDB, staff);
      logger.log(`  customers: ${seededCustomers.length}`);

      await seedGamesAndTransactions(tx as unknown as DrizzleDB, seededCustomers);
      logger.log(`  games and transactions seeded`);

      // Last, because VIP qualification and spin winners are derived from
      // the transactions above rather than invented alongside them.
      const engagement = await seedEngagement(tx as unknown as DrizzleDB, staff, seededCustomers);
      logger.log(
        `  vip: ${engagement.criteria} criteria, ${engagement.qualifications} qualifications`,
      );
      logger.log(`  spins: ${engagement.events} events, ${engagement.winners} winners`);
      logger.log(`  audit: ${engagement.audit} entries`);
    });

    logger.log('Seed completed successfully');
    logger.log(`All seeded accounts share the password: ${SEED_PASSWORD}`);
    logger.log('  master@sambehen.local / manager1@sambehen.local / store11@sambehen.local');
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
