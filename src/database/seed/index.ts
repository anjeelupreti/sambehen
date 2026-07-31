import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

/**
 * Database seed runner — `npm run db:seed`.
 *
 * Seeders run in dependency order and must be idempotent, so the command
 * can be re-run against an existing database without duplicating rows.
 *
 * Phase 1 registers the staff/customer seeders; the runner is wired up
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
    await db.transaction(async () => {
      // await seedStaff(tx);
      // await seedCustomers(tx);
      // await seedGamesAndTransactions(tx);
    });
    logger.log('Seed completed successfully');
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
