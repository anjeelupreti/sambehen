import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkList, ApiErrors } from '@common/swagger/api-response.decorators';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { AuditService } from '@shared/audit/audit.service';
import { AuditLogDto, AuditLogFilterDto, AuditLogSummaryDto } from './dto/audit-log.dto';

/**
 * The audit trail.
 *
 * Master-only, and deliberately not scoped: entries span every chain and
 * their payloads name customers, so a filtered view for a manager would
 * leak the existence of records the rest of the system hides. Either you
 * can read the trail or you cannot.
 */
@ApiTags('Audit')
@Controller('team/audit-logs')
@TeamAuth(StaffRole.MASTER)
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ResponseMessage('Audit logs retrieved successfully')
  @ApiOperation({
    summary: 'List audit entries',
    description: [
      'Append-only record of every state-changing action: who did what, when, from where,',
      'and which request it belonged to. Filter by actor, action prefix, entity, correlation',
      'id or date range.',
      '',
      'The before/after payloads are omitted from the list — they are large, they are the',
      'most sensitive part of a row even after redaction, and a table cannot render them.',
      'Filter by entityId to follow one record through its whole history.',
    ].join(' '),
  })
  @ApiOkList(AuditLogDto, AuditLogSummaryDto)
  @ApiErrors(401, 403, 422)
  findAll(
    @Query() filters: AuditLogFilterDto,
  ): Promise<IPaginatedResult<AuditLogDto, AuditLogSummaryDto>> {
    return this.auditService.findAll(filters);
  }
}
