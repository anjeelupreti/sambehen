import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VipMetric } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/** Columns the VIP criteria list may be sorted by. */
export const VIP_CRITERIA_SORT_FIELDS = [
  'name',
  'tier',
  'thresholdAmount',
  'periodStart',
  'periodEnd',
  'createdAt',
] as const;

/** Columns the VIP list may be sorted by. */
export const VIP_SORT_FIELDS = ['qualifiedAt', 'achievedAmount', 'tier'] as const;

export class CreateVipCriteriaDto {
  @ApiProperty({ example: 'Gold Tier Q3', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Higher tier means more exclusive. Used for ordering and display.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tier?: number = 1;

  @ApiProperty({
    enum: VipMetric,
    enumName: 'VipMetric',
    example: VipMetric.TOTAL_DEBIT,
    description: [
      'What the threshold is measured against.',
      '',
      'Allowed values:',
      '- `total_debit` — sum of debits (money in). Ignores credits, so a withdrawal does not reduce standing already earned.',
      '- `net` — debits minus credits, including corrections, so a corrected entry does not count.',
      '- `transaction_count` — number of transactions, ignoring amounts.',
    ].join('\n'),
  })
  @IsEnum(VipMetric)
  metric!: VipMetric;

  @ApiProperty({
    type: String,
    example: '1000.00',
    description:
      'Value a customer must reach. Money for total_debit and net; a plain count for transaction_count.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'thresholdAmount must be a positive decimal' })
  thresholdAmount!: string;

  @ApiProperty({
    format: 'date',
    example: '2026-07-01',
    description: 'Inclusive first day of the window. A date, not a timestamp.',
  })
  @IsDateString({ strict: false })
  periodStart!: string;

  @ApiProperty({
    format: 'date',
    example: '2026-09-30',
    description: 'Inclusive last day of the window. Must be on or after periodStart.',
  })
  @IsDateString({ strict: false })
  periodEnd!: string;
}

export class UpdateVipCriteriaDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tier?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Changing this triggers a full recompute of who qualifies.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'thresholdAmount must be a positive decimal' })
  @IsOptional()
  thresholdAmount?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Changing this triggers a full recompute.' })
  @IsDateString({ strict: false })
  @IsOptional()
  periodStart?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Changing this triggers a full recompute.' })
  @IsDateString({ strict: false })
  @IsOptional()
  periodEnd?: string;

  @ApiPropertyOptional({
    description:
      'Deactivating retains existing qualification records but stops the criteria counting as currently active.',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class VipCriteriaFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ description: 'Filter by the isActive flag alone, ignoring dates.' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'true returns only CURRENTLY ACTIVE criteria: isActive AND today inside [periodStart, periodEnd]. This is the set spin events may attach to.',
  })
  @IsBoolean()
  @IsOptional()
  currentlyActive?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tier?: number;

  @ApiPropertyOptional({ enum: VipMetric, enumName: 'VipMetric' })
  @IsEnum(VipMetric)
  @IsOptional()
  metric?: VipMetric;

  @ApiPropertyOptional({
    enum: VIP_CRITERIA_SORT_FIELDS,
    description: `Column to sort by. One of: ${VIP_CRITERIA_SORT_FIELDS.join(', ')}. Defaults to periodStart descending.`,
    example: 'periodStart',
  })
  @IsIn(VIP_CRITERIA_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class VipFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict to one criteria.' })
  @IsUUID('4')
  @IsOptional()
  criteriaId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tier?: number;

  @ApiPropertyOptional({
    description:
      'true returns only qualifications whose criteria window contains today — the current VIPs. Omit to see VIPs across every time frame.',
  })
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Master only.' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner." })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional({
    enum: VIP_SORT_FIELDS,
    description: `Column to sort by. One of: ${VIP_SORT_FIELDS.join(', ')}. Defaults to qualifiedAt descending.`,
    example: 'qualifiedAt',
  })
  @IsIn(VIP_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class VipCriteriaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: 1 })
  tier!: number;

  @ApiProperty({ enum: VipMetric, enumName: 'VipMetric' })
  metric!: VipMetric;

  @ApiProperty({ type: String, example: '1000.00' })
  thresholdAmount!: string;

  @ApiProperty({ format: 'date', example: '2026-07-01' })
  periodStart!: string;

  @ApiProperty({ format: 'date', example: '2026-09-30' })
  periodEnd!: string;

  @ApiProperty({ description: 'The isActive flag alone.' })
  isActive!: boolean;

  @ApiProperty({
    description:
      'isActive AND today inside the window. Only currently-active criteria may host a spin event.',
  })
  isCurrentlyActive!: boolean;

  @ApiPropertyOptional({ description: 'How many customers currently meet this threshold.' })
  qualifiedCount?: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class VipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ nullable: true })
  customerUsername!: string | null;

  @ApiProperty({ nullable: true })
  customerFullName!: string | null;

  @ApiProperty({ format: 'uuid' })
  criteriaId!: string;

  @ApiProperty()
  criteriaName!: string;

  @ApiProperty({ example: 1 })
  tier!: number;

  @ApiProperty({ enum: VipMetric, enumName: 'VipMetric' })
  metric!: VipMetric;

  @ApiProperty({ type: String, example: '1450.00', description: 'What the customer reached.' })
  achievedAmount!: string;

  @ApiProperty({ type: String, example: '1000.00', description: 'The bar in force at the time.' })
  thresholdAmount!: string;

  @ApiProperty({ format: 'date' })
  periodStart!: string;

  @ApiProperty({ format: 'date' })
  periodEnd!: string;

  @ApiProperty({ description: 'Whether the criteria window contains today.' })
  isCurrentlyActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  qualifiedAt!: Date;
}

/** A customer's own VIP standing, for the portal. */
export class VipStatusDto {
  @ApiProperty({
    description: 'True when the customer qualifies for at least one active criteria.',
  })
  isVip!: boolean;

  @ApiProperty({ example: 2, nullable: true, description: 'Highest tier currently held.' })
  currentTier!: number | null;

  @ApiProperty({ type: [Object], description: 'Progress against every currently-active criteria.' })
  criteria!: {
    criteriaId: string;
    name: string;
    tier: number;
    metric: VipMetric;
    achieved: string;
    threshold: string;
    percent: number;
    qualified: boolean;
    periodStart: string;
    periodEnd: string;
  }[];
}
