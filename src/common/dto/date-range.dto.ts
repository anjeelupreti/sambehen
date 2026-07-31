import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsDate, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Date-range filtering shared by transactions, VIPs, messages, campaigns
 * and every export.
 *
 * `lastNDays` is a shorthand the dashboard and email targeting UIs use; when
 * present it takes precedence over explicit bounds, which keeps
 * "last 30 days" a single parameter rather than two computed timestamps.
 */
export class DateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound (ISO 8601). Ignored when lastNDays is supplied.',
    example: '2026-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound (ISO 8601). Ignored when lastNDays is supplied.',
    example: '2026-07-31T23:59:59.999Z',
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  @ValidateIf((dto: DateRangeQueryDto) => dto.dateFrom !== undefined)
  dateTo?: Date;

  @ApiPropertyOptional({
    description: 'Rolling window ending now. Takes precedence over dateFrom/dateTo when supplied.',
    minimum: 1,
    maximum: 3650,
    example: 30,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  @IsOptional()
  lastNDays?: number;
}
