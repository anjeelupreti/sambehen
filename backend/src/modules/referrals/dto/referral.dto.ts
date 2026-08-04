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
import { ReferralRewardType, ReferralStatus } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';
import { IdListDto } from '@common/dto/id-list.dto';

const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export const REFERRAL_PROGRAM_SORT_FIELDS = ['name', 'validFrom', 'validTo', 'createdAt'] as const;
export const REFERRAL_SORT_FIELDS = ['status', 'createdAt', 'rewardedAt'] as const;

export class CreateReferralProgramDto {
  @ApiProperty({ example: 'Summer Friend Referral', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ReferralRewardType,
    enumName: 'ReferralRewardType',
    example: ReferralRewardType.FIXED,
    description: [
      'How the bonus amounts are interpreted.',
      '',
      'Allowed values:',
      '- `fixed` — the configured amount is paid as-is.',
      "- `percentage` — the amount is a percentage of the referee's qualifying deposits.",
    ].join('\n'),
  })
  @IsEnum(ReferralRewardType)
  rewardType!: ReferralRewardType;

  @ApiProperty({
    type: String,
    example: '50.00',
    description: 'Paid to the customer who shared the code.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'referrerBonus must be a positive decimal' })
  referrerBonus!: string;

  @ApiProperty({
    type: String,
    example: '25.00',
    description: 'Paid to the customer who signed up through the code.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'refereeBonus must be a positive decimal' })
  refereeBonus!: string;

  @ApiPropertyOptional({
    type: String,
    example: '100.00',
    default: '0.00',
    description:
      'How much the referee must deposit before the reward is granted. 0 pays out on signup alone. Only debits count.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'minQualifyingDebit must be a positive decimal' })
  @IsOptional()
  minQualifyingDebit?: string;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Cap on rewards one referrer can earn under this program. Omit for unlimited.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRewardsPerReferrer?: number;

  @ApiProperty({ format: 'date', example: '2026-07-01' })
  @IsDateString({ strict: false })
  validFrom!: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-12-31',
    description: 'Omit for open-ended.',
  })
  @IsDateString({ strict: false })
  @IsOptional()
  validTo?: string;
}

export class UpdateReferralProgramDto {
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

  @ApiPropertyOptional({
    type: String,
    description:
      'Applies to future rewards only. Amounts already granted are copied onto the referral row and never rewritten.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'referrerBonus must be a positive decimal' })
  @IsOptional()
  referrerBonus?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'refereeBonus must be a positive decimal' })
  @IsOptional()
  refereeBonus?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'minQualifyingDebit must be a positive decimal' })
  @IsOptional()
  minQualifyingDebit?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRewardsPerReferrer?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString({ strict: false })
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/** Bulk assignment: the master selects which customers get a code. */
export class AssignReferralCodesDto extends IdListDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Cap on redemptions per issued code. Omit for unlimited.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'When the issued codes stop working.' })
  @IsDateString({ strict: false })
  @IsOptional()
  expiresAt?: string;
}

export class ReferralProgramFilterDto extends BaseFilterDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'true returns only programs valid today: active and inside their validity window.',
  })
  @IsBoolean()
  @IsOptional()
  currentlyValid?: boolean;

  @ApiPropertyOptional({
    enum: REFERRAL_PROGRAM_SORT_FIELDS,
    description: `Column to sort by. One of: ${REFERRAL_PROGRAM_SORT_FIELDS.join(', ')}.`,
    example: 'createdAt',
  })
  @IsIn(REFERRAL_PROGRAM_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class ReferralFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: ReferralStatus, enumName: 'ReferralStatus' })
  @IsEnum(ReferralStatus)
  @IsOptional()
  status?: ReferralStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  programId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  referrerCustomerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Master only.' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner." })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional({
    enum: REFERRAL_SORT_FIELDS,
    description: `Column to sort by. One of: ${REFERRAL_SORT_FIELDS.join(', ')}.`,
    example: 'createdAt',
  })
  @IsIn(REFERRAL_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class ReferralProgramResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ReferralRewardType, enumName: 'ReferralRewardType' })
  rewardType!: ReferralRewardType;

  @ApiProperty({ type: String })
  referrerBonus!: string;

  @ApiProperty({ type: String })
  refereeBonus!: string;

  @ApiProperty({ type: String })
  minQualifyingDebit!: string;

  @ApiProperty({ type: Number, nullable: true })
  maxRewardsPerReferrer!: number | null;

  @ApiProperty({ format: 'date' })
  validFrom!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  validTo!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ description: 'Active and inside the validity window today.' })
  isCurrentlyValid!: boolean;

  @ApiPropertyOptional({ description: 'Codes issued under this program.' })
  issuedCodes?: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class ReferralCodeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: String, nullable: true })
  customerUsername!: string | null;

  @ApiProperty({ example: 'BRZK7QP4' })
  code!: string;

  @ApiProperty({
    example: 'http://localhost:3000/r/8fK2mQ7xR4nT',
    description: 'Full shareable URL, built from REFERRAL_LINK_BASE_URL.',
  })
  referralLink!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 3 })
  usageCount!: number;

  @ApiProperty({ type: Number, nullable: true })
  maxUses!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: Date | null;
}

export class ReferralResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty()
  programName!: string;

  @ApiProperty({ format: 'uuid' })
  referrerCustomerId!: string;

  @ApiProperty({ type: String, nullable: true })
  referrerUsername!: string | null;

  @ApiProperty({ format: 'uuid' })
  refereeCustomerId!: string;

  @ApiProperty({ type: String, nullable: true })
  refereeUsername!: string | null;

  @ApiProperty({ enum: ReferralStatus, enumName: 'ReferralStatus' })
  status!: ReferralStatus;

  @ApiProperty({ type: String, nullable: true })
  referrerReward!: string | null;

  @ApiProperty({ type: String, nullable: true })
  refereeReward!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  rewardedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class ReferralSummaryDto {
  @ApiProperty({ example: 240 })
  totalReferrals!: number;

  @ApiProperty({ example: 60 })
  pending!: number;

  @ApiProperty({ example: 180 })
  rewarded!: number;

  @ApiProperty({ example: 4 })
  rejected!: number;

  @ApiProperty({ type: String, example: '13500.00', description: 'Total bonus granted.' })
  totalRewarded!: string;
}

/** The customer's own referral view. */
export class MyReferralDto {
  @ApiProperty({ type: String, nullable: true, example: 'BRZK7QP4' })
  code!: string | null;

  @ApiProperty({ type: String, nullable: true })
  referralLink!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The program this code was issued under.',
  })
  programName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'What a successful referral earns.' })
  referrerBonus!: string | null;

  @ApiProperty({ example: 5, description: 'People who signed up with this code.' })
  totalReferred!: number;

  @ApiProperty({ example: 3, description: 'Referrals that have paid out.' })
  totalRewarded!: number;

  @ApiProperty({ type: String, example: '150.00', description: 'Bonus earned from referrals.' })
  totalEarned!: string;

  @ApiProperty({ type: String, example: '150.00', description: 'Current bonus balance.' })
  bonusBalance!: string;
}

/** Public program metadata resolved from a shared link. */
export class PublicReferralDto {
  @ApiProperty({ example: 'BRZK7QP4' })
  code!: string;

  @ApiProperty()
  programName!: string;

  @ApiProperty({ type: String, description: 'What the new customer receives.' })
  refereeBonus!: string;

  @ApiProperty({ type: String, description: 'How much they must deposit to earn it.' })
  minQualifyingDebit!: string;

  @ApiProperty({ description: 'False when expired, exhausted or deactivated.' })
  isValid!: boolean;
}
