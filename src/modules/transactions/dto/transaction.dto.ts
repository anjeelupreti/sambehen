import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDate,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionStatus } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

/**
 * Money arrives as a decimal string, never a number.
 *
 * A JSON number would be parsed as a float, so 10.10 can already be
 * 10.099999999999999 before validation ever sees it. The pattern permits
 * at most two decimal places, matching numeric(18,2).
 */
const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/** Columns the transaction list may be sorted by. */
export const TRANSACTION_SORT_FIELDS = [
  'amount',
  'type',
  'status',
  'occurredAt',
  'createdAt',
] as const;

/**
 * Conventional payment channels. Deliberately not an enum: operators add
 * their own, and rejecting an unlisted one would block data entry. Listed
 * here so the documentation shows the expected set.
 */
export const TRANSACTION_CHANNELS = [
  'cash',
  'bank_transfer',
  'card',
  'wallet',
  'crypto',
  'voucher',
  'other',
] as const;

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId!: string;

  @ApiProperty({
    enum: TransactionType,
    enumName: 'TransactionType',
    example: TransactionType.DEBIT,
    description: [
      'Direction of the money.',
      '',
      'Allowed values:',
      '- `debit` — money IN from the customer (deposit or spend). Adds to balance.',
      '- `credit` — money OUT to the customer. Subtracts from balance.',
    ].join('\n'),
  })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    type: String,
    example: '250.00',
    description:
      'Decimal string with at most two places. Sent as a string, not a number, so float parsing cannot alter it in transit.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message: 'amount must be a positive decimal with at most 2 decimal places',
  })
  amount!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Game this transaction is attributed to' })
  @IsUUID('4')
  @IsOptional()
  gameId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    example: 'bank_transfer',
    description: `How the money moved. Free text; conventional values: ${TRANSACTION_CHANNELS.map((c) => `\`${c}\``).join(', ')}.`,
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  channel?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'External reference, e.g. a bank slip number',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  referenceNo?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'When the money actually moved, which may differ from when it was keyed in. Defaults to now. Cannot be more than 24 hours in the future.',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurredAt?: Date;
}

/**
 * A correction against an existing transaction.
 *
 * Always recorded as a credit linked to its parent, never as an edit of
 * the original: history stays intact and the correction is visible as a
 * correction. Because it carries a parent it is excluded from
 * `totalWithdrawn`, so fixing a mis-keyed entry does not look like the
 * customer took money out.
 */
export class CreateCorrectionDto {
  @ApiProperty({
    type: String,
    example: '50.00',
    description:
      'How much of the parent to reverse. Corrections against one parent may not exceed its amount in total.',
  })
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message: 'amount must be a positive decimal with at most 2 decimal places',
  })
  amount!: string;

  @ApiProperty({ maxLength: 1000, description: 'Why the correction was needed' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  gameId?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  channel?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  referenceNo?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurredAt?: Date;
}

export class TransactionFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: TransactionType, enumName: 'TransactionType' })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    enumName: 'TransactionStatus',
    description: [
      'Allowed values:',
      '- `pending` — recorded but not yet settled',
      '- `completed` — settled; the default for new entries',
      '- `reversed` — fully corrected by one or more corrections',
    ].join('\n'),
  })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  gameId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Master only' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner" })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Staff member who keyed the entry' })
  @IsUUID('4')
  @IsOptional()
  enteredByStaffId?: string;

  @ApiPropertyOptional({
    description: 'true returns only corrections (credits WITH a parent); false excludes them.',
  })
  @IsBoolean()
  @IsOptional()
  isCorrection?: boolean;

  @ApiPropertyOptional({
    description:
      'true returns only genuine withdrawals: credits with NO parent. This is what "withdrawn" means throughout the system.',
  })
  @IsBoolean()
  @IsOptional()
  isWithdrawal?: boolean;

  @ApiPropertyOptional({ type: String, example: '100.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'minAmount must be a positive decimal' })
  @IsOptional()
  minAmount?: string;

  @ApiPropertyOptional({ type: String, example: '5000.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'maxAmount must be a positive decimal' })
  @IsOptional()
  maxAmount?: string;

  @ApiPropertyOptional({
    enum: TRANSACTION_SORT_FIELDS,
    description: `Column to sort by. One of: ${TRANSACTION_SORT_FIELDS.map((f) => `\`${f}\``).join(', ')}. Defaults to \`occurredAt\` descending.`,
    example: 'occurredAt',
  })
  @IsIn(TRANSACTION_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiPropertyOptional({ nullable: true })
  customerUsername?: string | null;

  @ApiProperty({ enum: TransactionType, enumName: 'TransactionType' })
  type!: TransactionType;

  @ApiProperty({ type: String, example: '250.00' })
  amount!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  gameId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  gameName?: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Present only on corrections. Its presence excludes this row from totalWithdrawn.',
  })
  parentTransactionId!: string | null;

  @ApiProperty({ description: 'True when this row is a correction rather than a withdrawal' })
  isCorrection!: boolean;

  @ApiProperty({ enum: TransactionStatus, enumName: 'TransactionStatus' })
  status!: TransactionStatus;

  @ApiProperty({ nullable: true })
  channel!: string | null;

  @ApiProperty({ nullable: true })
  referenceNo!: string | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: Date;

  @ApiProperty({ format: 'uuid' })
  enteredByStaffId!: string;

  @ApiPropertyOptional({ nullable: true })
  enteredByUsername?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

/** Aggregates over the whole filtered set, not the current page. */
export class TransactionSummaryDto {
  @ApiProperty({ example: 1840 })
  totalCount!: number;

  @ApiProperty({ type: String, example: '482900.00', description: 'Sum of debits — money in' })
  totalIn!: string;

  @ApiProperty({ type: String, example: '301240.50', description: 'Sum of credits — money out' })
  totalOut!: string;

  @ApiProperty({ type: String, example: '181659.50', description: 'totalIn minus totalOut' })
  net!: string;

  @ApiProperty({ example: 12, description: 'Credits carrying a parent' })
  correctionCount!: number;

  @ApiProperty({ type: String, example: '640.00' })
  correctionTotal!: string;
}
