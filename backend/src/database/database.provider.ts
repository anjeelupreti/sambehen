import { Provider, Logger, Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_PROVIDER = Symbol('DRIZZLE_PROVIDER');
export const PG_POOL = Symbol('PG_POOL');

export type DrizzleDB = NodePgDatabase<typeof schema>;

/**
 * The connection pool, provided separately from the drizzle handle so that
 * something is able to close it.
 *
 * Drizzle wraps a pool but exposes no way to shut it down, so while the two
 * were built together in one factory nothing could end the pool: sockets
 * stayed open past `app.close()` and kept the process alive, which under
 * SIGTERM means the container never exits on its own and gets killed with
 * work in flight.
 */
export const PgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<Pool> => {
    const logger = new Logger('DatabaseProvider');

    const dbUrl = configService.get<string>('database.url');
    const poolConfig = dbUrl
      ? {
          connectionString: dbUrl,
          ssl: configService.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
          min: configService.get<number>('database.poolMin'),
          max: configService.get<number>('database.poolMax'),
        }
      : {
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          user: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          ssl: configService.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
          min: configService.get<number>('database.poolMin'),
          max: configService.get<number>('database.poolMax'),
        };

    const pool = new Pool(poolConfig);

    // node-postgres's own docs warn about this: an *idle* client can still
    // emit 'error' (a dropped connection, the server restarting under it),
    // and Pool is an EventEmitter — with no listener, that error event
    // throws and takes the entire Node process down, not just the one
    // request that was using the connection. A dropped connection should
    // cost a failed query and a log line, not the whole API.
    pool.on('error', (error) => {
      logger.error(`Idle database client error: ${error.message}`, error.stack);
    });

    // Verify connection eagerly: a bad DSN should fail at boot, loudly,
    // rather than on the first request that happens to need the database.
    try {
      const client = await pool.connect();
      client.release();
      logger.log('✅ Database connection established successfully');
    } catch (error) {
      logger.error('❌ Failed to connect to database', error);
      await pool.end().catch(() => undefined);
      throw error;
    }

    return pool;
  },
};

export const DatabaseProvider: Provider = {
  provide: DRIZZLE_PROVIDER,
  inject: [PG_POOL, ConfigService],
  useFactory: (pool: Pool, configService: ConfigService): DrizzleDB =>
    drizzle(pool, {
      schema,
      logger: configService.get<string>('app.nodeEnv') !== 'production',
    }),
};

/**
 * Ends the pool on shutdown. A class, because only class providers get
 * lifecycle hooks — a factory provider has nowhere to hang one.
 */
@Injectable()
export class DatabaseLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseLifecycle.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      // `end()` rejects if the pool is already closed. Shutdown is not a
      // good moment to fail over connections that are already gone.
      this.logger.warn(
        `Database pool did not close cleanly: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
