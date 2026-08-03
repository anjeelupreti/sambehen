import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { CustomerAssignmentService } from './customer-assignment.service';

/**
 * CustomerAssignmentService is exported because the customers module
 * (phase 2) needs it too: it is the only sanctioned writer of the
 * ownership columns that ScopeService depends on.
 */
@Module({
  controllers: [StaffController],
  providers: [StaffService, CustomerAssignmentService],
  exports: [StaffService, CustomerAssignmentService],
})
export class StaffModule {}
