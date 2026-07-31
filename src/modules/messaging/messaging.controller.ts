import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff, CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff, ICurrentCustomer } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { MessagingService } from './messaging.service';
import {
  SendMessageDto,
  StartConversationDto,
  MarkReadDto,
  ConversationFilterDto,
  MessageThreadQueryDto,
  ConversationResponseDto,
  ConversationSummaryDto,
  MessageResponseDto,
  UnreadCountDto,
} from './dto/messaging.dto';

/**
 * Staff inbox.
 *
 * Every route has a WebSocket equivalent, but REST is the source of truth:
 * a client on a flaky connection, or one that simply does not want a
 * socket, must be able to do everything over plain HTTP.
 *
 * Unread is per viewer throughout. A runner, their manager and the master
 * all see the same thread but track their own read position, so a message
 * the runner has answered is still unread for the master until they look.
 */
@ApiTags('Messaging')
@Controller('team/conversations')
@TeamAuth()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  @ResponseMessage('Conversations retrieved successfully')
  @ApiOperation({
    summary: 'Scoped inbox with per-viewer unread counts',
    description:
      'Scoped through the owning customer: a runner sees their own customers, a manager their chain, a master everything. `summary` reports totals over the whole filtered set, not the page — "43 unread" is only useful if it means the whole inbox. Filters: unreadOnly, todayOnly, awaitingReply, activeCustomersOnly, status, assignedStaffId, managerId, runnerId, and search across customer details and message bodies.',
  })
  @ApiOkList(ConversationResponseDto, ConversationSummaryDto)
  @ApiErrors(401, 404, 422)
  findInbox(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: ConversationFilterDto,
  ): Promise<IPaginatedResult<ConversationResponseDto, ConversationSummaryDto>> {
    return this.messagingService.findInbox(actor, filters);
  }

  @Get(':id/messages')
  @ResponseMessage('Messages retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Thread messages, newest first',
    description:
      'Cursor-paginated rather than offset: a thread grows at the end being read, so with OFFSET a message arriving mid-scroll would shift every later page and the reader would see duplicates. Opening a thread marks it read for the current viewer only.',
  })
  @ApiOkData(Object, 'Messages and next cursor')
  @ApiErrors(401, 404, 422)
  findMessages(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessageThreadQueryDto,
  ): Promise<{ data: MessageResponseDto[]; nextCursor: string | null }> {
    return this.messagingService.findMessages(actor, id, query);
  }

  @Post('messages')
  @ResponseMessage('Message sent successfully')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a message to a customer',
    description:
      'Creates the thread on first contact. The staff sender is always recorded internally, even though customer-facing responses omit it.',
  })
  @ApiCreatedData(MessageResponseDto, 'Message sent')
  @ApiErrors(401, 404, 422, 429)
  send(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: StartConversationDto,
  ): Promise<MessageResponseDto> {
    return this.messagingService.sendAsStaff(actor, dto.customerId, dto);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Conversation marked as read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Mark a conversation read for the current viewer',
    description:
      'Affects only this staff member. Everyone else in the chain keeps their own unread count.',
  })
  @ApiOkData(Object, 'Read state updated')
  @ApiErrors(401, 404)
  markRead(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkReadDto,
  ): Promise<{ conversationId: string; unreadCount: number }> {
    return this.messagingService.markRead(actor, id, dto);
  }
}

/** The customer's own thread. */
@ApiTags('Customer Portal')
@Controller('me')
export class CustomerMessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('messages')
  @CustomerAuth()
  @ResponseMessage('Messages retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's message thread",
    description:
      'One continuous thread with the business. Internal staff attribution is omitted: the customer sees that the business replied, not which runner. The data is still stored, so that presentation choice can change without a migration.',
  })
  @ApiOkData(Object, 'Messages and next cursor')
  @ApiErrors(401, 422)
  thread(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Query() query: MessageThreadQueryDto,
  ): Promise<{ data: MessageResponseDto[]; nextCursor: string | null }> {
    return this.messagingService.customerThread(actor.id, query);
  }

  @Get('messages/unread-count')
  @CustomerAuth()
  @ResponseMessage('Unread count retrieved successfully')
  @ApiOperation({ summary: 'Staff replies since the customer last wrote' })
  @ApiOkData(UnreadCountDto)
  @ApiErrors(401)
  unread(@CurrentCustomer() actor: ICurrentCustomer): Promise<UnreadCountDto> {
    return this.messagingService.customerUnreadCount(actor.id);
  }

  @Post('messages')
  @CustomerAuth()
  @ResponseMessage('Message sent successfully')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a message to the business',
    description:
      'Creates the thread on first send. Rate-limited more tightly than staff sending, since a customer has no legitimate reason to send at speed.',
  })
  @ApiCreatedData(MessageResponseDto, 'Message sent')
  @ApiErrors(401, 422, 429)
  send(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagingService.sendAsCustomer(actor.id, dto);
  }
}
