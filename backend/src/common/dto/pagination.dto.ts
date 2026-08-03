import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IPaginationOptions } from '../interfaces/pagination.interface';
import { SortOrder } from '../constants/app.constants';

/** Largest page a client may request, guarding against accidental full scans. */
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Query parameters shared by every list endpoint.
 *
 * Domain filter DTOs extend this, so pagination, search and sorting behave
 * identically across the API.
 */
export class PaginationQueryDto implements IPaginationOptions {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    example: 25,
    description: `Rows per page. Capped at ${MAX_PAGE_SIZE}.`,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description:
      'Free-text search. Matched case-insensitively across the searchable columns of the resource; LIKE wildcards in the term are escaped.',
    example: 'john',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      "Column to sort by. Each resource overrides this with its own enumerated list of sortable columns; see the specific endpoint. An unrecognised value falls back to the resource's default ordering rather than sorting by an arbitrary column.",
    example: 'createdAt',
  })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    enum: SortOrder,
    enumName: 'SortOrder',
    default: SortOrder.DESC,
    description: 'Sort direction. Allowed values: `asc`, `desc`.',
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}
