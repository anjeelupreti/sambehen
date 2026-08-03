import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportService } from './export.service';
import { ExportWriterService } from './export-writer.service';
import { ExportDefinitions } from './export-definitions';
import { CustomersModule } from '@modules/customers/customers.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';
import { StaffModule } from '@modules/staff/staff.module';
import { GamesModule } from '@modules/games/games.module';
import { VipModule } from '@modules/vip/vip.module';
import { ReferralsModule } from '@modules/referrals/referrals.module';
import { SpinsModule } from '@modules/spins/spins.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { EmailingModule } from '@modules/emailing/emailing.module';

/**
 * Imports every feature module whose list is exportable, because each
 * definition calls that module's own service rather than querying the
 * database itself — which is what keeps exports and lists in agreement.
 */
@Module({
  imports: [
    CustomersModule,
    TransactionsModule,
    StaffModule,
    GamesModule,
    VipModule,
    ReferralsModule,
    SpinsModule,
    MessagingModule,
    EmailingModule,
  ],
  controllers: [ExportsController],
  providers: [ExportService, ExportWriterService, ExportDefinitions],
  exports: [ExportService],
})
export class ExportsModule {}
