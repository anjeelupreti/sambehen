import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from './database.provider';

/**
 * Injectable service wrapping the Drizzle database instance.
 * Use this when you prefer constructor injection over @Inject(DRIZZLE_PROVIDER).
 */
@Injectable()
export class DrizzleService {
  constructor(
    @Inject(DRIZZLE_PROVIDER)
    private readonly db: DrizzleDB,
  ) {}

  /**
   * Returns the raw Drizzle DB instance for direct query building.
   */
  getDb(): DrizzleDB {
    return this.db;
  }
}
