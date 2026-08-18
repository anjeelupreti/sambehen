import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiOkMessage,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { SpinsService } from './spins.service';
import {
  CreateSpinEventDto,
  UpdateSpinEventDto,
  RecordWinnersDto,
  SpinEventFilterDto,
  RecentWinnersFilterDto,
  SpinWinnersListFilterDto,
  SpinEventResponseDto,
  SpinWinnerListItemDto,
  SpinWinnerSummaryDto,
  RecentWinnerDto,
} from './dto/spin.dto';

/**
 * Spin events, recorded as data entry rather than run as a game.
 *
 * Master-only: an event decides who may win a prize, and it attaches to a
 * VIP criteria that it inherits its window from, so eligibility and timing
 * can never disagree.
 */
@ApiTags('Spin Events')
@Controller('team/spin-events')
@TeamAuth()
export class SpinEventsController {
  constructor(private readonly spinsService: SpinsService) {}

  @Post()
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Spin event created successfully')
  @ApiOperation({
    summary: 'Create a spin event (master only)',
    description:
      'The VIP criteria must be CURRENTLY ACTIVE — an event on a closed window would have an eligibility set nobody could still join, and one on a future window would accept winners before anyone could qualify. In `preselected` mode winners are required now and every one must already hold a qualification for that criteria.',
  })
  @ApiCreatedData(SpinEventResponseDto, 'Spin event created')
  @ApiErrors(401, 403, 404, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateSpinEventDto,
  ): Promise<SpinEventResponseDto> {
    return this.spinsService.createEvent(actor, dto);
  }

  @Get()
  @ResponseMessage('Spin events retrieved successfully')
  @ApiOperation({
    summary: 'List spin events',
    description:
      'Readable by all staff. Not scoped — an event belongs to the business, not a chain.',
  })
  @ApiOkList(SpinEventResponseDto)
  @ApiErrors(401, 422)
  findAll(@Query() filters: SpinEventFilterDto): Promise<IPaginatedResult<SpinEventResponseDto>> {
    return this.spinsService.findAllEvents(filters);
  }

  @Get(':id')
  @ResponseMessage('Spin event retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a spin event with its winners' })
  @ApiOkData(SpinEventResponseDto)
  @ApiErrors(401, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SpinEventResponseDto> {
    return this.spinsService.findEvent(id);
  }

  @Post(':id/winners')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Winners recorded successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Record winners after the draw (master only)',
    description:
      'Applies the same VIP eligibility rule as preselection, so how a winner was determined never changes whether they were allowed to win. Refused once the event is completed or cancelled, and a customer cannot win the same event twice.',
  })
  @ApiOkData(SpinEventResponseDto, 'Winners recorded')
  @ApiErrors(401, 403, 404, 409, 422)
  recordWinners(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordWinnersDto,
  ): Promise<SpinEventResponseDto> {
    return this.spinsService.recordWinners(actor, id, dto);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Spin event updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Update a spin event (master only)',
    description:
      'Status normally advances on its own; set it here only to cancel an event or correct a mistake.',
  })
  @ApiOkData(SpinEventResponseDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpinEventDto,
  ): Promise<SpinEventResponseDto> {
    return this.spinsService.updateEvent(actor, id, dto);
  }

  @Delete(':id/winners/:winnerId')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Winner removed successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'winnerId', format: 'uuid' })
  @ApiOperation({
    summary: 'Remove a recorded winner (master only)',
    description:
      'Data entry is fallible and a winner keyed against the wrong customer must be removable. The removed row is audited in full.',
  })
  @ApiOkMessage('Winner removed')
  @ApiErrors(401, 403, 404)
  removeWinner(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('winnerId', ParseUUIDPipe) winnerId: string,
  ): Promise<null> {
    return this.spinsService.removeWinner(actor, id, winnerId);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Spin event deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete a spin event (master only)' })
  @ApiOkMessage('Spin event deleted')
  @ApiErrors(401, 403, 404)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.spinsService.removeEvent(actor, id);
  }
}

/**
 * The winners register, for staff.
 *
 * A separate controller from the masked feed below, on its own path, so
 * the two can never be confused: this one names customers and is scoped,
 * that one is anonymised and deliberately is not.
 */
@ApiTags('Spin Events')
@Controller('team/spin-winners')
@TeamAuth()
export class TeamSpinWinnersController {
  constructor(private readonly spinsService: SpinsService) {}

  @Get()
  @ResponseMessage('Spin winners retrieved successfully')
  @ApiOperation({
    summary: 'List spin winners',
    description: [
      'Every recorded win, named and scoped: a store sees wins by their own customers,',
      'a manager sees their chain, a master sees all. Filterable by event, customer,',
      'ownership, announcement date and whether the winner was preselected.',
      '',
      'The summary totals cover the whole filtered set rather than the current page.',
    ].join(' '),
  })
  @ApiOkList(SpinWinnerListItemDto, SpinWinnerSummaryDto)
  @ApiErrors(401, 404, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: SpinWinnersListFilterDto,
  ): Promise<IPaginatedResult<SpinWinnerListItemDto, SpinWinnerSummaryDto>> {
    return this.spinsService.findWinners(actor, filters);
  }
}

/** Recent winners, for staff. Same masked feed the customers see. */
@ApiTags('Spin Events')
@Controller('team/recent-winners')
@TeamAuth()
export class TeamRecentWinnersController {
  constructor(private readonly spinsService: SpinsService) {}

  @Get()
  @ResponseMessage('Recent winners retrieved successfully')
  @ApiOperation({
    summary: 'Recent spin winners',
    description: 'The same masked feed customers see, so staff can verify what is being displayed.',
  })
  @ApiOkList(RecentWinnerDto)
  @ApiErrors(401, 422)
  findAll(@Query() filters: RecentWinnersFilterDto): Promise<IPaginatedResult<RecentWinnerDto>> {
    return this.spinsService.recentWinners(filters);
  }
}

/** Recent winners, for customers. */
@ApiTags('Customer Portal')
@Controller('me')
export class CustomerRecentWinnersController {
  constructor(private readonly spinsService: SpinsService) {}

  @Get('recent-winners')
  @CustomerAuth()
  @ResponseMessage('Recent winners retrieved successfully')
  @ApiOperation({
    summary: 'Recent spin winners',
    description:
      'Names are partially masked and customer ids are omitted entirely, so the feed cannot be used to enumerate accounts. A customer should recognise their own win without anyone else being able to identify them.',
  })
  @ApiOkList(RecentWinnerDto)
  @ApiErrors(401, 422)
  findAll(@Query() filters: RecentWinnersFilterDto): Promise<IPaginatedResult<RecentWinnerDto>> {
    return this.spinsService.recentWinners(filters);
  }
}
