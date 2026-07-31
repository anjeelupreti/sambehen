import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StaffRole } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

const lower = ({ value }: { value: string }): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateStaffDto {
  @ApiProperty({ example: 'runner1@sambehen.local' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  @Transform(lower)
  email!: string;

  @ApiProperty({ example: 'runner1', minLength: 3, maxLength: 100 })
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

  @ApiProperty({
    enum: [StaffRole.MANAGER, StaffRole.RUNNER],
    description:
      'Only manager and runner can be created. A master is provisioned by the seed, since there is exactly one and it has no parent.',
  })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Managing staff member. Required when a master creates a runner. Ignored for a manager creating a runner, which always attaches to that manager.',
  })
  @IsUUID('4')
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'runner1@sambehen.local' })
  @IsEmail()
  @MaxLength(255)
  @Transform(lower)
  @IsOptional()
  email?: string;
}

export class ResetStaffPasswordDto {
  @ApiProperty({ example: 'NewStrongPass456!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Force the account to change this password at next sign-in. Defaults to true, since the password was chosen by someone else.',
  })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean = true;
}

export class ReassignRunnerDto {
  @ApiProperty({ format: 'uuid', description: 'The manager this runner should report to' })
  @IsUUID('4')
  newManagerId!: string;
}

/** Columns the staff list may be sorted by. */
export const STAFF_SORT_FIELDS = [
  'email',
  'username',
  'role',
  'isActive',
  'lastLoginAt',
  'createdAt',
] as const;

export class StaffFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  @IsEnum(StaffRole)
  @IsOptional()
  role?: StaffRole;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter to the direct reports of this staff member.',
  })
  @IsUUID('4')
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
  @ApiPropertyOptional({
    enum: STAFF_SORT_FIELDS,
    description:
      'Column to sort by. One of: ' + STAFF_SORT_FIELDS.join(', ') + '. Defaults to createdAt.',
    example: 'createdAt',
  })
  @IsIn(STAFF_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class StaffResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  role!: StaffRole;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastLoginAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
