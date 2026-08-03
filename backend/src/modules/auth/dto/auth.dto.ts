import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { StaffRole } from '@common/constants/app.constants';

export class LoginDto {
  @ApiProperty({
    description: 'Email address or username',
    example: 'master@sambehen.local',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  identifier!: string;

  @ApiProperty({ example: 'ChangeMe123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued alongside the access token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangeOwnPasswordDto {
  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewStrongPass456!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class TokenPairDto {
  @ApiProperty({ description: 'Short-lived bearer token for the Authorization header' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived token, rotated on every refresh' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}

export class StaffProfileDto {
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

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  role!: StaffRole;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'Managing staff member' })
  parentId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ description: 'Client should force a password change before continuing' })
  mustChangePassword!: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastLoginAt!: Date | null;
}

export class CustomerProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  fullName!: string | null;

  @ApiProperty({ description: 'Account status' })
  status!: string;

  @ApiProperty({ type: String, description: 'Decimal serialised as a string' })
  balance!: string;

  @ApiProperty({ type: String, description: 'Decimal serialised as a string' })
  bonusBalance!: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastLoginAt!: Date | null;
}

export class TeamLoginResponseDto extends TokenPairDto {
  @ApiProperty({ type: StaffProfileDto })
  user!: StaffProfileDto;
}

export class CustomerLoginResponseDto extends TokenPairDto {
  @ApiProperty({ type: CustomerProfileDto })
  user!: CustomerProfileDto;
}
