import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_PROVIDER = Symbol('DRIZZLE_PROVIDER');

export type DrizzleDB = NodePgDatabase<typeof schema>;

export const DatabaseProvider: Provider = {
  provide: DRIZZLE_PROVIDER,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<DrizzleDB> => {
    const logger = new Logger('DatabaseProvider');

    const pool = new Pool({
      host: configService.get<string>('database.host'),
      port: configService.get<number>('database.port'),
      user: configService.get<string>('database.username'),
      password: configService.get<string>('database.password'),
      database: configService.get<string>('database.name'),
      ssl: configService.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
      min: configService.get<number>('database.poolMin'),
      max: configService.get<number>('database.poolMax'),
    });

    // Verify connection
    try {
      const client = await pool.connect();
      client.release();
      logger.log('✅ Database connection established successfully');
    } catch (error) {
      logger.error('❌ Failed to connect to database', error);
      throw error;
    }

    return drizzle(pool, {
      schema,
      logger: configService.get<string>('app.nodeEnv') !== 'production',
    });
  },
};
