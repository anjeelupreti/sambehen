import { Module, Global } from '@nestjs/common';
import { DatabaseProvider, DRIZZLE_PROVIDER } from './database.provider';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  providers: [DatabaseProvider, DrizzleService],
  exports: [DRIZZLE_PROVIDER, DrizzleService],
})
export class DatabaseModule {}
