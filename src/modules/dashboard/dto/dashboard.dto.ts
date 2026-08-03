import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, IsDate, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/** Bucket size for the trend series. */
export enum TrendGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class DashboardFilterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Master only. Narrow to one manager chain.' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner." })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;
}

export class TrendQueryDto extends DashboardFilterDto {
  @ApiPropertyOptional({
    enum: TrendGranularity,
    enumName: 'TrendGranularity',
    default: TrendGranularity.DAY,
    description: [
      'Bucket size.',
      '',
      'Allowed values:',
      '- `day` — one point per day',
      '- `week` — one point per ISO week',
      '- `month` — one point per calendar month',
    ].join('\n'),
  })
  @IsEnum(TrendGranularity)
  @IsOptional()
  granularity?: TrendGranularity = TrendGranularity.DAY;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 730,
    default: 30,
    description: 'How far back to go, in days.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  @IsOptional()
  lastNDays?: number = 30;

  @ApiPropertyOptional({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateFrom?: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateTo?: Date;
}

/** in / out / balance for a period. */
export class NetPositionDto {
  @ApiProperty({ type: String, example: '482900.00', description: 'Sum of debits — money in.' })
  totalIn!: string;

  @ApiProperty({ type: String, example: '301240.50', description: 'Sum of credits — money out.' })
  totalOut!: string;

  @ApiProperty({ type: String, example: '181659.50', description: 'totalIn minus totalOut.' })
  balance!: string;

  @ApiProperty({ example: 1840 })
  transactionCount!: number;
}

export class MonthlyNetDto extends NetPositionDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 12.4,
    description:
      'Percentage change in net against the previous month. Null when the previous month was zero, since a percentage change from nothing is undefined rather than infinite.',
  })
  changePercent!: number | null;

  @ApiProperty({
    type: String,
    example: '161500.00',
    description: 'Previous month net, for context.',
  })
  previousBalance!: string;
}

export class TopGameDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Null groups transactions with no game.',
  })
  gameId!: string | null;

  @ApiProperty({ nullable: true, example: 'Golden Dragon' })
  gameName!: string | null;

  @ApiProperty({ type: String, example: '48200.00' })
  total!: string;

  @ApiProperty({ example: 184 })
  transactionCount!: number;
}

export class CustomerMetricsDto {
  @ApiProperty({ example: 1240 })
  total!: number;

  @ApiProperty({ example: 812, description: 'Status active and seen within the activity window.' })
  active!: number;

  @ApiProperty({ example: 428 })
  inactive!: number;

  @ApiProperty({ example: 37, description: 'Registered this calendar month.' })
  newThisMonth!: number;
}

export class VipMetricsDto {
  @ApiProperty({
    example: 64,
    description: 'Customers qualifying under a currently-active criteria.',
  })
  activeVips!: number;

  @ApiProperty({
    type: [Object],
    description: 'Breakdown by tier, highest first.',
    example: [{ tier: 2, count: 18 }],
  })
  byTier!: { tier: number; count: number }[];
}

export class MessagingMetricsDto {
  @ApiProperty({ example: 43, description: 'Unread for the CURRENT VIEWER, not a shared counter.' })
  unreadMessages!: number;

  @ApiProperty({ example: 8 })
  conversationsToday!: number;

  @ApiProperty({ example: 12, description: 'Staff replies sent today.' })
  responsesToday!: number;

  @ApiProperty({ example: 9, description: 'Latest message is from the customer.' })
  awaitingReply!: number;
}

/** One row of the team breakdown, whose meaning depends on the viewer. */
export class TeamRollupRowDto {
  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ example: 'manager' })
  role!: string;

  @ApiProperty({ example: 120 })
  customerCount!: number;

  @ApiProperty({ type: String, example: '240500.00' })
  totalIn!: string;

  @ApiProperty({ type: String, example: '150200.00' })
  totalOut!: string;

  @ApiProperty({ type: String, example: '90300.00' })
  balance!: string;
}

export class DashboardResponseDto {
  @ApiProperty({
    example: 'master',
    description: 'Whose data this represents. Everything below is scoped to that actor.',
  })
  scope!: string;

  @ApiProperty({ type: NetPositionDto, description: 'All-time in, out and balance.' })
  allTime!: NetPositionDto;

  @ApiProperty({
    type: MonthlyNetDto,
    description: 'This calendar month, with change on the previous.',
  })
  thisMonth!: MonthlyNetDto;

  @ApiProperty({ type: [TopGameDto], description: 'Highest money IN, by game.' })
  topGamesByDebit!: TopGameDto[];

  @ApiProperty({ type: [TopGameDto], description: 'Highest money OUT, by game.' })
  topGamesByCredit!: TopGameDto[];

  @ApiProperty({ type: CustomerMetricsDto })
  customers!: CustomerMetricsDto;

  @ApiProperty({ type: VipMetricsDto })
  vips!: VipMetricsDto;

  @ApiProperty({ type: MessagingMetricsDto })
  messaging!: MessagingMetricsDto;

  @ApiProperty({
    type: [TeamRollupRowDto],
    description:
      'For a master, one row per manager; for a manager, one row per runner plus their own directly-owned customers; empty for a runner, who is a leaf.',
  })
  teamRollup!: TeamRollupRowDto[];

  @ApiProperty({ format: 'date-time', description: 'When these figures were computed.' })
  generatedAt!: Date;
}

export class TrendPointDto {
  @ApiProperty({ format: 'date', example: '2026-07-15' })
  bucket!: string;

  @ApiProperty({ type: String, example: '12400.00' })
  totalIn!: string;

  @ApiProperty({ type: String, example: '8100.00' })
  totalOut!: string;

  @ApiProperty({ type: String, example: '4300.00' })
  balance!: string;

  @ApiProperty({ example: 46 })
  transactionCount!: number;
}

export class TrendResponseDto {
  @ApiProperty({ enum: TrendGranularity, enumName: 'TrendGranularity' })
  granularity!: TrendGranularity;

  @ApiProperty({
    type: [TrendPointDto],
    description:
      'Gap-filled: buckets with no activity are returned as zeros rather than omitted, so a chart shows a flat line instead of joining across the gap.',
  })
  points!: TrendPointDto[];
}

/** The customer's own overview. */
export class CustomerDashboardDto {
  @ApiProperty({ type: String, example: '1250.00' })
  balance!: string;

  @ApiProperty({ type: String, example: '50.00' })
  bonusBalance!: string;

  @ApiProperty({ type: String, example: '4820.00', description: 'Total deposited.' })
  totalSpent!: string;

  @ApiProperty({
    type: String,
    example: '1250.00',
    description: 'Credits with no parent transaction. Corrections are excluded.',
  })
  totalWithdrawn!: string;

  @ApiProperty({ example: 42 })
  transactionCount!: number;

  @ApiProperty({ description: 'Qualifies under at least one currently-active criteria.' })
  isVip!: boolean;

  @ApiProperty({ nullable: true, example: 2 })
  vipTier!: number | null;

  @ApiProperty({ example: 3, description: 'Unread staff replies.' })
  unreadMessages!: number;

  @ApiProperty({ example: 1, description: 'Spin events this customer has won.' })
  totalWins!: number;
}
