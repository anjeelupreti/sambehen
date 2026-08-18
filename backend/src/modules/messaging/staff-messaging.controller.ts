import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { StaffMessagingService } from './staff-messaging.service';
import {
  SendStaffMessageDto,
  StaffMarkReadDto,
  StaffConversationFilterDto,
  StaffContactFilterDto,
  StaffMessageThreadQueryDto,
  StaffContactDto,
  StaffConversationResponseDto,
  StaffMessageResponseDto,
} from './dto/staff-messaging.dto';

/**
 * Internal staff-to-staff messaging.
 *
 * Deliberately separate from `/team/conversations`, which is staff-to-
 * customer: different participants, different scoping rule (hierarchy
 * rather than customer ownership), and no reason for a customer thread and
 * an internal one to ever be confused with each other.
 *
 * Who may message whom: a store may reach their own manager or any
 * master; a manager may reach their own stores or any master; a master
 * may reach anyone. Either side may open the conversation — there is no
 * "senior speaks first" gate here, unlike the customer-facing flow.
 */
@ApiTags('Staff Messaging')
@Controller('team/staff-conversations')
@TeamAuth()
export class StaffMessagingController {
  constructor(private readonly staffMessagingService: StaffMessagingService) {}

  @Get('contacts')
  @ResponseMessage('Contacts retrieved successfully')
  @ApiOperation({
    summary: 'Staff the actor may open a DM with',
    description:
      'Scoped by hierarchy: a store sees their own manager and any master; a manager sees their own stores and any master; a master sees everyone.',
  })
  @ApiOkList(StaffContactDto)
  @ApiErrors(401)
  contacts(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: StaffContactFilterDto,
  ): Promise<StaffContactDto[]> {
    return this.staffMessagingService.contacts(actor, filters);
  }

  @Get()
  @ResponseMessage('Conversations retrieved successfully')
  @ApiOperation({ summary: 'Internal inbox: every thread the actor holds, newest first' })
  @ApiOkList(StaffConversationResponseDto)
  @ApiErrors(401, 422)
  findInbox(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: StaffConversationFilterDto,
  ): Promise<IPaginatedResult<StaffConversationResponseDto>> {
    return this.staffMessagingService.findInbox(actor, filters);
  }

  @Get(':id/messages')
  @ResponseMessage('Messages retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Thread messages, newest first',
    description: 'Refused as not-found if the actor is not a participant in this thread.',
  })
  @ApiOkData(Object, 'Messages and next cursor')
  @ApiErrors(401, 404, 422)
  findMessages(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StaffMessageThreadQueryDto,
  ): Promise<{ data: StaffMessageResponseDto[]; nextCursor: string | null }> {
    return this.staffMessagingService.findMessages(actor, id, query);
  }

  @Post('messages')
  @ResponseMessage('Message sent successfully')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send an internal message',
    description:
      'Creates the thread on first contact. Refused if the target is outside the hierarchy rule.',
  })
  @ApiCreatedData(StaffMessageResponseDto, 'Message sent')
  @ApiErrors(401, 403, 422, 429)
  send(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: SendStaffMessageDto,
  ): Promise<StaffMessageResponseDto> {
    return this.staffMessagingService.send(actor, dto);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Conversation marked as read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Mark a thread read for the current viewer' })
  @ApiOkData(Object, 'Read state updated')
  @ApiErrors(401, 404)
  markRead(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffMarkReadDto,
  ): Promise<{ conversationId: string; unreadCount: number }> {
    return this.staffMessagingService.markRead(actor, id, dto);
  }
}
