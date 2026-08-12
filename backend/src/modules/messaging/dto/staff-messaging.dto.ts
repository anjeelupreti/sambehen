import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffRole } from '@common/constants/app.constants';
import { PaginationQueryDto } from '@common/dto/pagination.dto';
import { MessageAttachmentDto, MAX_MESSAGE_LENGTH, MAX_MESSAGE_ATTACHMENTS } from './messaging.dto';

/** Internal staff-to-staff messaging — a separate thread type from customer conversations. */

export class SendStaffMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Who the message goes to.' })
  @IsUUID('4')
  targetStaffId!: string;

  @ApiProperty({
    maxLength: MAX_MESSAGE_LENGTH,
    description: 'May be empty only if at least one attachment is present.',
  })
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  body!: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], maxItems: MAX_MESSAGE_ATTACHMENTS })
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  @IsOptional()
  attachments?: MessageAttachmentDto[];
}

export class StaffMarkReadDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  lastReadMessageId?: string;
}

export class StaffConversationFilterDto extends PaginationQueryDto {}

export class StaffContactFilterDto {
  @ApiPropertyOptional({ description: 'Search by username, name or email.' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;
}

export class StaffMessageThreadQueryDto {
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

export class StaffContactDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  fullName!: string | null;

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  role!: StaffRole;
}

export class StaffMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ format: 'uuid' })
  senderStaffId!: string;

  @ApiProperty()
  senderUsername!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], nullable: true })
  attachments?: MessageAttachmentDto[] | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class StaffConversationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The other participant, not the viewer.' })
  counterpartId!: string;

  @ApiProperty()
  counterpartUsername!: string;

  @ApiProperty({ type: String, nullable: true })
  counterpartFullName!: string | null;

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  counterpartRole!: StaffRole;

  @ApiProperty({ type: String, nullable: true })
  lastMessagePreview!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty()
  messageCount!: number;

  @ApiProperty({ description: 'Unread for the CURRENT VIEWER, not a shared counter.' })
  unreadCount!: number;
}
