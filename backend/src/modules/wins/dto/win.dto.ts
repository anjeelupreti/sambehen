import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination.dto';

const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export class RecordWinDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  gameId?: string;

  @ApiProperty({ type: String, example: '1250.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message: 'amount must be a positive decimal with at most 2 decimal places',
  })
  amount!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Defaults to now.' })
  @IsOptional()
  @IsISO8601()
  wonAt?: string;
}

export class UpdateWinDto {
  @ApiProperty({ description: 'Hide from the players’ wins feed, or show again.' })
  @IsBoolean()
  hidden!: boolean;
}

export class WinListQueryDto extends PaginationQueryDto {}

/** A win as staff see it: the full name and who recorded it. */
export class WinDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerUsername!: string;

  @ApiProperty({ type: String, nullable: true })
  customerAvatarUrl!: string | null;

  @ApiProperty({ description: 'Whether the player lets their wins be shown.' })
  customerShowsWins!: boolean;

  @ApiProperty({ type: String, nullable: true })
  gameName!: string | null;

  @ApiProperty({ type: String, example: '1250.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  wonAt!: Date;

  @ApiProperty()
  hidden!: boolean;

  @ApiProperty({ type: String, nullable: true })
  recordedBy!: string | null;
}

/** A win as players see it: first name and last initial, nothing that identifies the account. */
export class WinFeedItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jolene H.' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  gameName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  gameImageUrl!: string | null;

  @ApiProperty({ type: String, example: '1250.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  wonAt!: Date;

  @ApiProperty({ description: 'The signed-in player’s own win.' })
  mine!: boolean;
}

export class WinFeedDto {
  @ApiProperty({ type: [WinFeedItemDto], description: 'Newest first, last 30 days.' })
  recent!: WinFeedItemDto[];

  @ApiProperty({ type: [WinFeedItemDto], description: 'Largest first, last 7 days.' })
  topThisWeek!: WinFeedItemDto[];

  @ApiProperty({ description: 'Whether the signed-in player’s wins are shown to others.' })
  showMine!: boolean;
}

export class WinVisibilityDto {
  @ApiProperty()
  @IsBoolean()
  show!: boolean;
}
