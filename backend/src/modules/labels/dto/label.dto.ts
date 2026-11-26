import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AutoLabel } from '../auto-labels';

/** The palette labels are drawn from; the app maps each to its own colours. */
export const LABEL_COLORS = [
  'blue',
  'green',
  'amber',
  'red',
  'purple',
  'pink',
  'teal',
  'gray',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export class LabelDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Regular' })
  name!: string;

  @ApiProperty({ enum: LABEL_COLORS })
  color!: string;
}

export class LabelWithUsageDto extends LabelDto {
  @ApiProperty({ description: 'Players carrying this label, among those the viewer can see.' })
  playerCount!: number;
}

export class CreateLabelDto {
  @ApiProperty({ example: 'Regular', minLength: 1, maxLength: 40 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiProperty({ enum: LABEL_COLORS })
  @IsIn(LABEL_COLORS)
  color!: LabelColor;
}

export class UpdateLabelDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 40 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ enum: LABEL_COLORS })
  @IsOptional()
  @IsIn(LABEL_COLORS)
  color?: LabelColor;
}

export class SetCustomerLabelsDto {
  @ApiProperty({ type: [String], description: 'The full set of labels the player should carry.' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  labelIds!: string[];
}

/** What every player row carries: their manual labels and automatic ones. */
export class PlayerLabelsDto {
  @ApiProperty({ type: [LabelDto] })
  labels!: LabelDto[];

  @ApiProperty({ enum: AutoLabel, isArray: true, enumName: 'AutoLabel' })
  autoLabels!: AutoLabel[];
}
