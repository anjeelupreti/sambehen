import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsArray,
  IsDate,
  ValidateNested,
  ArrayMaxSize,
  ArrayNotEmpty,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpinSelectionMode, SpinEventStatus } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export const SPIN_EVENT_SORT_FIELDS = ['name', 'scheduledAt', 'status', 'createdAt'] as const;

/** Upper bound on winners recorded in one request. */
export const MAX_WINNERS_PER_REQUEST = 100;

export class SpinWinnerInputDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "Must already hold a VIP qualification for the event's criteria, otherwise the entry is rejected.",
  })
  @IsUUID('4')
  customerId!: string;

  @ApiPropertyOptional({ maxLength: 200, example: 'Grand Prize' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  prizeLabel?: string;

  @ApiPropertyOptional({ type: String, example: '500.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'prizeAmount must be a positive decimal' })
  @IsOptional()
  prizeAmount?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: '1 is first place.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  rank?: number = 1;
}

export class CreateSpinEventDto {
  @ApiProperty({ example: 'August Grand Spin', maxLength: 150 })
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
    format: 'uuid',
    description:
      'The VIP criteria this event runs under. Must be CURRENTLY ACTIVE. The event inherits the criteria window, so eligibility and timing can never disagree.',
  })
  @IsUUID('4')
  vipCriteriaId!: string;

  @ApiProperty({
    enum: SpinSelectionMode,
    enumName: 'SpinSelectionMode',
    example: SpinSelectionMode.POST_DRAW,
    description: [
      'How winners are determined.',
      '',
      'Allowed values:',
      '- `preselected` — winners chosen now from qualified VIPs. `winners` is REQUIRED.',
      '- `post_draw` — the draw happens elsewhere; winners are keyed in afterwards. `winners` must be omitted.',
    ].join('\n'),
  })
  @IsEnum(SpinSelectionMode)
  selectionMode!: SpinSelectionMode;

  @ApiProperty({ format: 'date-time', description: 'When the spin takes place.' })
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  prizeDescription?: string;

  @ApiPropertyOptional({ type: String, example: '5000.00' })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'prizePool must be a positive decimal' })
  @IsOptional()
  prizePool?: string;

  @ApiPropertyOptional({
    type: [SpinWinnerInputDto],
    maxItems: MAX_WINNERS_PER_REQUEST,
    description:
      'Required when selectionMode is `preselected`, rejected otherwise. Every customer must already qualify for the criteria.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_WINNERS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => SpinWinnerInputDto)
  @IsOptional()
  winners?: SpinWinnerInputDto[];
}

export class UpdateSpinEventDto {
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

  @ApiPropertyOptional({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledAt?: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  prizeDescription?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: 'prizePool must be a positive decimal' })
  @IsOptional()
  prizePool?: string;

  @ApiPropertyOptional({
    enum: SpinEventStatus,
    enumName: 'SpinEventStatus',
    description: [
      'Allowed values:',
      '- `scheduled` — created, not yet due',
      '- `live` — the scheduled time has passed and the criteria window is open',
      '- `completed` — finished; winners are final',
      '- `cancelled` — called off. Winners can no longer be recorded.',
      '',
      'Status normally advances automatically; set it here only to cancel or to correct a mistake.',
    ].join('\n'),
  })
  @IsEnum(SpinEventStatus)
  @IsOptional()
  status?: SpinEventStatus;
}

export class RecordWinnersDto {
  @ApiProperty({ type: [SpinWinnerInputDto], maxItems: MAX_WINNERS_PER_REQUEST })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_WINNERS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => SpinWinnerInputDto)
  winners!: SpinWinnerInputDto[];
}

export class SpinEventFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: SpinEventStatus, enumName: 'SpinEventStatus' })
  @IsEnum(SpinEventStatus)
  @IsOptional()
  status?: SpinEventStatus;

  @ApiPropertyOptional({ enum: SpinSelectionMode, enumName: 'SpinSelectionMode' })
  @IsEnum(SpinSelectionMode)
  @IsOptional()
  selectionMode?: SpinSelectionMode;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  vipCriteriaId?: string;

  @ApiPropertyOptional({
    enum: SPIN_EVENT_SORT_FIELDS,
    description: `Column to sort by. One of: ${SPIN_EVENT_SORT_FIELDS.join(', ')}. Defaults to scheduledAt descending.`,
    example: 'scheduledAt',
  })
  @IsIn(SPIN_EVENT_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

export class RecentWinnersFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  spinEventId?: string;
}

export class SpinWinnerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ nullable: true })
  customerUsername!: string | null;

  @ApiProperty({ nullable: true })
  customerFullName!: string | null;

  @ApiProperty({ nullable: true })
  prizeLabel!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '500.00' })
  prizeAmount!: string | null;

  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ description: 'Chosen at event creation rather than keyed in after the draw.' })
  isPreselected!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  announcedAt!: Date | null;
}

export class SpinEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ format: 'uuid' })
  vipCriteriaId!: string;

  @ApiProperty()
  vipCriteriaName!: string;

  @ApiProperty({ format: 'date', description: 'Inherited from the criteria.' })
  periodStart!: string;

  @ApiProperty({ format: 'date', description: 'Inherited from the criteria.' })
  periodEnd!: string;

  @ApiProperty({ enum: SpinSelectionMode, enumName: 'SpinSelectionMode' })
  selectionMode!: SpinSelectionMode;

  @ApiProperty({ enum: SpinEventStatus, enumName: 'SpinEventStatus' })
  status!: SpinEventStatus;

  @ApiProperty({ format: 'date-time' })
  scheduledAt!: Date;

  @ApiProperty({ nullable: true })
  prizeDescription!: string | null;

  @ApiProperty({ type: String, nullable: true })
  prizePool!: string | null;

  @ApiProperty({ example: 3 })
  winnerCount!: number;

  @ApiPropertyOptional({ type: [SpinWinnerResponseDto], description: 'Detail responses only.' })
  winners?: SpinWinnerResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

/** Public-facing winner entry, with the name partially masked. */
export class RecentWinnerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'Jo**n D.',
    description:
      'Partially masked. The customer id is deliberately omitted so the feed cannot be used to enumerate accounts.',
  })
  displayName!: string;

  @ApiProperty()
  eventName!: string;

  @ApiProperty({ nullable: true })
  prizeLabel!: string | null;

  @ApiProperty({ type: String, nullable: true })
  prizeAmount!: string | null;

  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ format: 'date-time', nullable: true })
  announcedAt!: Date | null;
}
