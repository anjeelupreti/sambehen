import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';

/**
 * Only a controller: the query lives on `AuditService`, which owns the
 * table and is already global. This module exists purely to expose a read
 * path for it.
 */
@Module({
  controllers: [AuditLogsController],
})
export class AuditLogsModule {}
