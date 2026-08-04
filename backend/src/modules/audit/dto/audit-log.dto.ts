import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

/** Who performed the action. `system` covers cron jobs and seeders. */
export const AUDIT_ACTOR_TYPES = ['team', 'customer', 'system'] as const;

export class AuditLogFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({
    enum: AUDIT_ACTOR_TYPES,
    enumName: 'AuditActorType',
    description: `One of: ${AUDIT_ACTOR_TYPES.join(', ')}. 'system' means a background job, which has no signed-in actor.`,
  })
  @IsIn(AUDIT_ACTOR_TYPES as unknown as string[])
  @IsOptional()
  actorType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Staff or customer id, per actorType.' })
  @IsUUID('4')
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    example: 'customer.',
    description:
      'Prefix match on the action verb, so "customer." returns every customer action rather than requiring the exact verb.',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: 'transaction' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Full history of one record.' })
  @IsUUID('4')
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Every entry written while handling one request.',
    example: 'b1f2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  correlationId?: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AUDIT_ACTOR_TYPES, enumName: 'AuditActorType' })
  actorType!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Null for system actions.',
  })
  actorId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'manager' })
  actorRole!: string | null;

  @ApiProperty({ example: 'transaction.correction' })
  action!: string;

  @ApiProperty({ type: String, nullable: true, example: 'transaction' })
  entityType!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'POST' })
  method!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '/api/v1/team/transactions' })
  path!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 201 })
  statusCode!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '10.0.0.4' })
  ip!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Ties the entry to the request log lines.',
  })
  correlationId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class AuditLogSummaryDto {
  @ApiProperty({ example: 1284 })
  totalEntries!: number;

  @ApiProperty({ example: 7 })
  distinctActors!: number;

  @ApiProperty({ example: 23 })
  distinctActions!: number;

  @ApiProperty({ example: 4, description: 'Entries whose request returned 4xx or 5xx.' })
  failedRequests!: number;
}
