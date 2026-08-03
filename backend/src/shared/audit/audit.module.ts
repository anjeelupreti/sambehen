import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Global so any feature module can inject AuditService without importing
 * this module explicitly. The interceptor is registered as an
 * APP_INTERCEPTOR in AppModule and is a no-op on routes lacking
 * `@Auditable(...)`.
 */
@Global()
@Module({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
