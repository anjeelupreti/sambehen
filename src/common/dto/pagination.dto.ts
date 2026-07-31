import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { IPaginationOptions } from '../interfaces/pagination.interface';

export class PaginationQueryDto implements IPaginationOptions {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
export class PaginationMetaDto {
  @ApiPropertyOptional()
  total!: number;

  @ApiPropertyOptional()
  page!: number;

  @ApiPropertyOptional()
  limit!: number;

  @ApiPropertyOptional()
  totalPages!: number;

  @ApiPropertyOptional()
  hasNextPage!: boolean;

  @ApiPropertyOptional()
  hasPreviousPage!: boolean;
}
