import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsIn,
  IsArray,
  IsDate,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus, ComparisonOperator } from '@common/constants/app.constants';
import { EmailKind } from '@shared/mailer/email-template.service';
import { BaseFilterDto } from '@common/dto/base-filter.dto';
import { MAX_BULK_IDS } from '@common/dto/id-list.dto';

const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export const CAMPAIGN_SORT_FIELDS = ['subject', 'status', 'createdAt', 'completedAt'] as const;

/**
 * One-click audience presets.
 *
 * Named after how staff actually think about the list, rather than the
 * underlying predicate, so the UI can offer them as buttons.
 */
export enum RecipientQuickFilter {
  ALL_ACTIVE = 'all_active',
  WITH_TRANSACTIONS = 'with_transactions',
  WITHOUT_TRANSACTIONS = 'without_transactions',
  RECENT_TRANSACTIONS = 'recent_transactions',
  HIGH_SPENDERS = 'high_spenders',
  LOW_SPENDERS = 'low_spenders',
}

/**
 * Who a campaign goes to.
 *
 * Every filter is ANDed, and the whole thing is intersected with the
 * actor's scope, so a manager can never mail another chain's customers.
 * Supplying `customerIds` restricts to that explicit selection — still
 * intersected with scope rather than trusted.
 */
export class RecipientFilterDto {
  @ApiPropertyOptional({
    enum: RecipientQuickFilter,
    enumName: 'RecipientQuickFilter',
    description: [
      'One-click audience preset.',
      '',
      'Allowed values:',
      '- `all_active` — status active and seen within the activity window',
      '- `with_transactions` — has at least one transaction',
      '- `without_transactions` — has never transacted',
      '- `recent_transactions` — transacted in the last 30 days',
      '- `high_spenders` — total debits at or above the configured threshold (default 250.00)',
      '- `low_spenders` — total debits below that threshold',
    ].join('\n'),
  })
  @IsEnum(RecipientQuickFilter)
  @IsOptional()
  quickFilter?: RecipientQuickFilter;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    description: 'Registered within the last N days. Takes precedence over startDate/endDate.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  @IsOptional()
  lastNDays?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Registered on or after.' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ format: 'date-time', description: 'Registered on or before.' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({
    enum: ComparisonOperator,
    enumName: 'ComparisonOperator',
    description: [
      'How to compare total spend (sum of debits).',
      '',
      'Allowed values:',
      '- `gt` — greater than minAmount',
      '- `gte` — at or above minAmount',
      '- `lt` — less than minAmount',
      '- `lte` — at or below minAmount',
      '- `eq` — exactly minAmount',
      '- `between` — from minAmount to maxAmount inclusive; both are required',
    ].join('\n'),
  })
  @IsEnum(ComparisonOperator)
  @IsOptional()
  spendingOperator?: ComparisonOperator;

  @ApiPropertyOptional({ type: String, example: '250.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'minAmount must be a positive decimal' })
  @ValidateIf((dto: RecipientFilterDto) => dto.spendingOperator !== undefined)
  @IsOptional()
  minAmount?: string;

  @ApiPropertyOptional({
    type: String,
    example: '1000.00',
    description: 'Required when spendingOperator is `between`.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'maxAmount must be a positive decimal' })
  @ValidateIf((dto: RecipientFilterDto) => dto.spendingOperator === ComparisonOperator.BETWEEN)
  @IsOptional()
  maxAmount?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Only customers who currently hold a VIP qualification.' })
  @IsBoolean()
  @IsOptional()
  isVip?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vipTier?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Master only.' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner." })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: MAX_BULK_IDS,
    description:
      "Explicit selection. Still intersected with the actor's scope, so an id from another chain is dropped rather than mailed.",
  })
  @IsArray()
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsUUID('4', { each: true })
  @IsOptional()
  customerIds?: string[];
}

export class PreviewRecipientsDto extends RecipientFilterDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 10,
    description: 'How many sample recipients to return alongside the count.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  sampleSize?: number = 10;
}

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 255, example: 'August promotions' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ description: 'Plain-text body. Always required, as the fallback part.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  bodyText!: string;

  @ApiPropertyOptional({ description: 'Optional HTML body.' })
  @IsString()
  @MaxLength(200_000)
  @IsOptional()
  bodyHtml?: string;

  @ApiPropertyOptional({
    enum: EmailKind,
    enumName: 'EmailKind',
    default: EmailKind.PROMOTIONAL,
    description: [
      'What kind of message this is. Decides the layout, accent colour and',
      'whether an unsubscribe footer appears — not merely cosmetic, since it',
      'changes what the message is allowed to contain.',
      '',
      'Allowed values:',
      '- `promotional` — offers and campaigns. Carries an unsubscribe footer.',
      '- `informational` — statements, summaries, general notices. Unsubscribable.',
      '- `notification` — something happened on the account: a win, a bonus, a VIP tier.',
      '- `transactional` — account and security mail. Never unsubscribable.',
      '- `alert` — needs attention: a failure, a suspension, a problem.',
    ].join('\n'),
  })
  @IsEnum(EmailKind)
  @IsOptional()
  emailKind?: EmailKind;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Send later. The dispatcher picks the campaign up once due.',
  })
  @IsDateString({ strict: false })
  @IsOptional()
  scheduledAt?: string;
}

export class SendCampaignDto {
  @ApiProperty({ type: RecipientFilterDto, description: 'Who receives it.' })
  // @ValidateNested is required, not decorative: with forbidNonWhitelisted
  // the global pipe rejects any property it cannot validate, so @Type alone
  // makes the whole `filter` object look like an unknown field.
  @ValidateNested()
  @Type(() => RecipientFilterDto)
  filter!: RecipientFilterDto;
}

export class CampaignFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  createdByStaffId?: string;

  @ApiPropertyOptional({
    enum: CAMPAIGN_SORT_FIELDS,
    description: `Column to sort by. One of: ${CAMPAIGN_SORT_FIELDS.join(', ')}.`,
    example: 'createdAt',
  })
  @IsIn(CAMPAIGN_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class RecipientPreviewDto {
  @ApiProperty({ example: 412, description: 'How many customers this filter selects.' })
  totalRecipients!: number;

  @ApiProperty({
    example: 18,
    description:
      'Selected but excluded from sending: no email address, opted out, or previously hard-bounced.',
  })
  excluded!: number;

  @ApiProperty({
    type: [Object],
    description: 'A sample, so the sender can sanity-check the audience before composing.',
  })
  sample!: { customerId: string; username: string; email: string; totalSpent: string }[];
}

export class CampaignResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty({ enum: EmailKind, enumName: 'EmailKind' })
  emailKind!: EmailKind;

  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  status!: CampaignStatus;

  @ApiProperty({ example: 412 })
  recipientCount!: number;

  @ApiProperty({ example: 398 })
  sentCount!: number;

  @ApiProperty({ example: 14 })
  failedCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdByStaffId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class CampaignRecipientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ example: 'sent' })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt!: Date | null;
}
