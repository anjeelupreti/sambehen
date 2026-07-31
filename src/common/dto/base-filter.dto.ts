import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Pagination + sorting + date range, the baseline every list filter extends.
 *
 * Composition rather than multiple inheritance, since TypeScript has no
 * mixins that `@nestjs/swagger`'s metadata scanner would follow reliably.
 */
export class BaseFilterDto extends PaginationQueryDto {
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
  dateTo?: Date;

  @ApiPropertyOptional({
    description: 'Rolling window ending now. Takes precedence over dateFrom/dateTo.',
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
