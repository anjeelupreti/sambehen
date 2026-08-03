import { Module, Global } from '@nestjs/common';
import {
  DatabaseProvider,
  DatabaseLifecycle,
  PgPoolProvider,
  DRIZZLE_PROVIDER,
  PG_POOL,
} from './database.provider';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  providers: [PgPoolProvider, DatabaseProvider, DatabaseLifecycle, DrizzleService],
  exports: [DRIZZLE_PROVIDER, PG_POOL, DrizzleService],
})
export class DatabaseModule {}
