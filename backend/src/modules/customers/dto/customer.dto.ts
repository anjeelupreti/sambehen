import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CustomerStatus } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';
import { IdListDto } from '@common/dto/id-list.dto';

const lower = ({ value }: { value: string }): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateCustomerDto {
  @ApiProperty({ example: 'customer99@example.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  @Transform(lower)
  email!: string;

  @ApiProperty({ example: 'customer99', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'username may only contain lowercase letters, digits, dot, underscore and hyphen',
  })
  @Transform(lower)
  username!: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;

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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Owning manager or runner. A runner may only assign to themselves, so this is ignored for them. Required when a master creates a customer, since a master cannot own customers directly.',
  })
  @IsUUID('4')
  @IsOptional()
  ownerStaffId?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    maxLength: 32,
    example: 'BRZK7QP4',
    description:
      'Referral code or link slug this customer arrived through. An unusable code is ignored rather than failing the signup, so a stale link never blocks a legitimate registration.',
  })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  referralCode?: string;
}

/**
 * Profile fields staff may change on a customer's behalf.
 *
 * Credentials are deliberately absent: a password change goes through the
 * dedicated reset endpoint so it can revoke sessions, and status changes
 * go through their own endpoint so they are audited as status changes
 * rather than buried in a profile edit.
 */
export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'customer99@example.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(lower)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;

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

  @ApiPropertyOptional({ description: 'Exclude this customer from every email campaign' })
  @IsBoolean()
  @IsOptional()
  emailOptOut?: boolean;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;
}

export class SetCustomerPasswordDto {
  @ApiProperty({ example: 'NewStrongPass456!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangeCustomerStatusDto {
  @ApiProperty({ enum: CustomerStatus, enumName: 'CustomerStatus' })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;

  @ApiPropertyOptional({ maxLength: 500, description: 'Recorded on the audit entry' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class ReassignCustomerDto {
  @ApiProperty({ format: 'uuid', description: 'New owning manager or runner' })
  @IsUUID('4')
  ownerStaffId!: string;
}

export class BulkReassignCustomersDto extends IdListDto {
  @ApiProperty({ format: 'uuid', description: 'New owning manager or runner' })
  @IsUUID('4')
  ownerStaffId!: string;
}

export class BulkStatusDto extends IdListDto {
  @ApiProperty({ enum: CustomerStatus, enumName: 'CustomerStatus' })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}

/** Columns the customer list may be sorted by. */
export const CUSTOMER_SORT_FIELDS = [
  'email',
  'username',
  'fullName',
  'status',
  'city',
  'balance',
  'lastActivityAt',
  'registeredAt',
  'createdAt',
] as const;

export class CustomerFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: CustomerStatus, enumName: 'CustomerStatus' })
  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;

  @ApiPropertyOptional({
    description:
      'Activity-based, not the status column: true means status is active AND last seen within the configured window (ACTIVE_CUSTOMER_WINDOW_DAYS, default 30).',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Override the activity window, in days, for this request only.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  activeWindowDays?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Master only. A manager supplying another manager's id gets an empty result.",
  })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Master, or a manager narrowing to one of their own runners.',
  })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Exclude customers who opted out of email' })
  @IsBoolean()
  @IsOptional()
  emailOptOut?: boolean;
  @ApiPropertyOptional({
    enum: CUSTOMER_SORT_FIELDS,
    description:
      'Column to sort by. One of: ' + CUSTOMER_SORT_FIELDS.join(', ') + '. Defaults to createdAt.',
    example: 'createdAt',
  })
  @IsIn(CUSTOMER_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  fullName!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ nullable: true })
  state!: string | null;

  @ApiProperty({ nullable: true })
  country!: string | null;

  @ApiProperty({ enum: CustomerStatus, enumName: 'CustomerStatus' })
  status!: CustomerStatus;

  @ApiProperty({
    type: String,
    example: '1250.00',
    description: 'numeric(18,2) serialised as a string so JS float precision cannot corrupt it',
  })
  balance!: string;

  @ApiProperty({ type: String, example: '50.00' })
  bonusBalance!: string;

  @ApiProperty({ format: 'uuid' })
  ownerStaffId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  managerId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  runnerId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Owning manager's username" })
  managerUsername?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Owning runner's username" })
  runnerUsername?: string | null;

  @ApiProperty()
  emailOptOut!: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastActivityAt!: Date | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastLoginAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  registeredAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  // ── Transaction-derived, computed per row ──────────────────

  @ApiPropertyOptional({ example: 42 })
  totalTransactions?: number;

  @ApiPropertyOptional({
    type: String,
    example: '4820.00',
    description: 'Sum of debits: money the customer put in.',
  })
  totalSpent?: string;

  @ApiPropertyOptional({
    type: String,
    example: '1250.00',
    description:
      'Sum of credits with NO parent transaction. Corrections are excluded, so this is money the customer actually took out.',
  })
  totalWithdrawn?: string;

  @ApiPropertyOptional({
    type: String,
    example: '40.00',
    description: 'Sum of credits WITH a parent transaction: bookkeeping fixes, not withdrawals.',
  })
  totalCorrections?: string;

  @ApiPropertyOptional({
    type: String,
    example: '3570.00',
    description: 'totalSpent minus all credits.',
  })
  netBalance?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastTransactionAt?: Date | null;
}

/** Aggregates over the whole filtered set, not the current page. */
export class CustomerListSummaryDto {
  @ApiProperty({ example: 1240 })
  totalCustomers!: number;

  @ApiProperty({ example: 812, description: 'status=active and seen within the activity window' })
  activeCustomers!: number;

  @ApiProperty({ example: 428 })
  inactiveCustomers!: number;

  @ApiProperty({ example: 12 })
  suspendedCustomers!: number;

  @ApiProperty({ type: String, example: '482900.00', description: 'Sum of balances' })
  totalBalance!: string;

  @ApiProperty({ type: String, example: '15300.00', description: 'Sum of bonus balances' })
  totalBonusBalance!: string;
}
