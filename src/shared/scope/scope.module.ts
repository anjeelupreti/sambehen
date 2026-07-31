import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service';
import { StaffRepository } from '@database/repositories/staff.repository';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { AuthSessionRepository } from '@database/repositories/auth-session.repository';

/**
 * Global, because ScopeService is consumed by every feature module that
 * touches customer-derived data. Making it ambient removes any excuse for
 * a module to skip it.
 *
 * The identity repositories are exported here too, since they are shared
 * by auth, staff and customers rather than owned by any one of them.
 */
@Global()
@Module({
  providers: [ScopeService, StaffRepository, CustomerRepository, AuthSessionRepository],
  exports: [ScopeService, StaffRepository, CustomerRepository, AuthSessionRepository],
})
export class ScopeModule {}
