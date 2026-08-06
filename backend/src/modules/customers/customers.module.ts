import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { PortalController } from './portal.controller';
import { CustomersService } from './customers.service';
import { CustomerImportService } from './customer-import.service';
import { StaffModule } from '@modules/staff/staff.module';
import { ReferralsModule } from '@modules/referrals/referrals.module';
import { TransactionRepository } from '@database/repositories/transaction.repository';

/**
 * StaffModule is imported for CustomerAssignmentService, the only
 * sanctioned writer of the ownership columns ScopeService depends on.
 */
@Module({
  imports: [StaffModule, ReferralsModule],
  controllers: [CustomersController, PortalController],
  providers: [CustomersService, CustomerImportService, TransactionRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
