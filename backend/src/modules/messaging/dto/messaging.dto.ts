import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConversationStatus, MessageSenderType } from '@common/constants/app.constants';
import { BaseFilterDto } from '@common/dto/base-filter.dto';

export const CONVERSATION_SORT_FIELDS = ['lastMessageAt', 'messageCount', 'createdAt'] as const;

/** Longest single message. Generous, but bounded so one send cannot be unbounded. */
export const MAX_MESSAGE_LENGTH = 4000;

export class SendMessageDto {
  @ApiProperty({ maxLength: MAX_MESSAGE_LENGTH, example: 'Your withdrawal has been processed.' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH)
  body!: string;
}

/** Staff sending to a customer who may not have a thread yet. */
export class StartConversationDto extends SendMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId!: string;
}

export class MarkReadDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Read up to and including this message. Omit to mark the whole thread read as of now.',
  })
  @IsUUID('4')
  @IsOptional()
  lastReadMessageId?: string;
}

export class ConversationFilterDto extends BaseFilterDto {
  @ApiPropertyOptional({ enum: ConversationStatus, enumName: 'ConversationStatus' })
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @ApiPropertyOptional({
    description:
      'Only conversations with messages the CURRENT VIEWER has not read. Unread is per viewer: a message read by the runner is still unread for their manager.',
  })
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only conversations with activity today.' })
  @IsBoolean()
  @IsOptional()
  todayOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Only conversations whose latest message came from the customer — those still awaiting a reply.',
  })
  @IsBoolean()
  @IsOptional()
  awaitingReply?: boolean;

  @ApiPropertyOptional({
    description:
      'Only conversations belonging to active customers (status active and seen within the activity window).',
  })
  @IsBoolean()
  @IsOptional()
  activeCustomersOnly?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  assignedStaffId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Master only.' })
  @IsUUID('4')
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Master, or a manager's own runner." })
  @IsUUID('4')
  @IsOptional()
  runnerId?: string;

  @ApiPropertyOptional({
    enum: CONVERSATION_SORT_FIELDS,
    description: `Column to sort by. One of: ${CONVERSATION_SORT_FIELDS.join(', ')}. Defaults to lastMessageAt descending.`,
    example: 'lastMessageAt',
  })
  @IsIn(CONVERSATION_SORT_FIELDS as unknown as string[])
  @IsOptional()
  override sortBy?: string;
}

/** Cursor pagination for a thread: threads grow indefinitely at one end. */
export class MessageThreadQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Return messages older than this one. Use the oldest id from the previous page.',
  })
  @IsUUID('4')
  @IsOptional()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, enumName: 'MessageSenderType' })
  senderType!: MessageSenderType;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Which staff member sent it. Always stored, but omitted from customer-facing responses — whether the customer sees internal attribution is a presentation decision.',
  })
  senderStaffId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  senderStaffUsername?: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: String, nullable: true })
  customerUsername!: string | null;

  @ApiProperty({ type: String, nullable: true })
  customerFullName!: string | null;

  @ApiProperty({ enum: ConversationStatus, enumName: 'ConversationStatus' })
  status!: ConversationStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assignedStaffId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastMessagePreview!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty({ example: 42 })
  messageCount!: number;

  @ApiProperty({
    example: 3,
    description: 'Unread for the CURRENT VIEWER, not a shared counter.',
  })
  unreadCount!: number;

  @ApiProperty({
    description: 'The latest message came from the customer, so a reply is outstanding.',
  })
  awaitingReply!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  managerId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  runnerId!: string | null;
}

/** Inbox metrics over the whole filtered set, not the current page. */
export class ConversationSummaryDto {
  @ApiProperty({ example: 128 })
  totalConversations!: number;

  @ApiProperty({
    example: 17,
    description: 'Conversations holding at least one message the current viewer has not read.',
  })
  unreadConversations!: number;

  @ApiProperty({ example: 43, description: 'Individual unread messages for the current viewer.' })
  totalUnreadMessages!: number;

  @ApiProperty({ example: 12, description: 'Staff replies sent today.' })
  responsesToday!: number;

  @ApiProperty({ example: 8, description: 'Conversations with any activity today.' })
  conversationsToday!: number;

  @ApiProperty({ example: 9, description: 'Latest message is from the customer.' })
  awaitingReply!: number;
}

export class UnreadCountDto {
  @ApiProperty({ example: 5 })
  unreadCount!: number;
}
