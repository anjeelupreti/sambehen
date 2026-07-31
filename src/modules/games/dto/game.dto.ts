import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

/** Sortable columns for the games list. Documented so clients see the set. */
export const GAME_SORT_FIELDS = ['name', 'code', 'category', 'isActive', 'createdAt'] as const;

/**
 * Suggested categories. Not enforced as an enum: operators add their own
 * over time, and rejecting an unlisted one would block data entry. Listed
 * so the documentation shows the conventional set.
 */
export const GAME_CATEGORY_SUGGESTIONS = [
  'slots',
  'table',
  'live',
  'sports',
  'lottery',
  'arcade',
  'other',
] as const;

export class CreateGameDto {
  @ApiProperty({ example: 'Golden Dragon', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 'GOLD_DRAGON',
    maxLength: 50,
    description: 'Stable identifier used in imports and exports. Uppercased automatically.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code may only contain uppercase letters, digits, underscore and hyphen',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @ApiPropertyOptional({
    maxLength: 80,
    example: 'slots',
    description: `Free text. Conventional values: ${GAME_CATEGORY_SUGGESTIONS.join(', ')}.`,
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;
}

export class UpdateGameDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    maxLength: 80,
    description: `Free text. Conventional values: ${GAME_CATEGORY_SUGGESTIONS.join(', ')}.`,
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Inactive games are rejected for new transactions but keep their history.',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GameFilterDto extends BaseFilterDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: `Conventional values: ${GAME_CATEGORY_SUGGESTIONS.join(', ')}.`,
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    enum: GAME_SORT_FIELDS,
    description: `Sortable columns: ${GAME_SORT_FIELDS.join(', ')}.`,
  })
  @IsIn(GAME_SORT_FIELDS as unknown as string[])
  @IsOptional()
  declare sortBy?: string;
}

export class GameResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
