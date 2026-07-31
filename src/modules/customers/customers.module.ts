import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { PortalController } from './portal.controller';
import { CustomersService } from './customers.service';
import { StaffModule } from '@modules/staff/staff.module';

/**
 * StaffModule is imported for CustomerAssignmentService, the only
 * sanctioned writer of the ownership columns ScopeService depends on.
 */
@Module({
  imports: [StaffModule],
  controllers: [CustomersController, PortalController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
