import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff, CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiOkMessage,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff, ICurrentCustomer } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { VipService } from './vip.service';
import {
  CreateVipCriteriaDto,
  UpdateVipCriteriaDto,
  VipCriteriaFilterDto,
  VipFilterDto,
  VipCriteriaResponseDto,
  VipResponseDto,
  VipStatusDto,
} from './dto/vip.dto';

/**
 * VIP thresholds.
 *
 * Only a master defines them, because a threshold change re-decides who is
 * a VIP across the whole business and determines who may win a spin event.
 */
@ApiTags('VIP Criteria')
@Controller('team/vip-criteria')
@TeamAuth()
export class VipCriteriaController {
  constructor(private readonly vipService: VipService) {}

  @Post()
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('VIP criteria created successfully')
  @ApiOperation({
    summary: 'Create a VIP criteria (master only)',
    description:
      'Qualifications are computed immediately, so a criteria defined over a past window lists its VIPs at once rather than after the nightly job.',
  })
  @ApiCreatedData(VipCriteriaResponseDto, 'VIP criteria created')
  @ApiErrors(401, 403, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateVipCriteriaDto,
  ): Promise<VipCriteriaResponseDto> {
    return this.vipService.createCriteria(actor, dto);
  }

  @Get()
  @ResponseMessage('VIP criteria retrieved successfully')
  @ApiOperation({
    summary: 'List VIP criteria',
    description:
      'Use `currentlyActive=true` for criteria whose window contains today — the only ones a spin event may attach to. `isActive` filters the flag alone, ignoring dates.',
  })
  @ApiOkList(VipCriteriaResponseDto)
  @ApiErrors(401, 422)
  findAll(
    @Query() filters: VipCriteriaFilterDto,
  ): Promise<IPaginatedResult<VipCriteriaResponseDto>> {
    return this.vipService.findAllCriteria(filters);
  }

  @Get(':id')
  @ResponseMessage('VIP criteria retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a VIP criteria' })
  @ApiOkData(VipCriteriaResponseDto)
  @ApiErrors(401, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<VipCriteriaResponseDto> {
    return this.vipService.findCriteria(id);
  }

  @Get(':id/eligible-customers')
  @ResponseMessage('Eligible customers retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Customers who qualify for this criteria',
    description:
      'Scoped to the actor. Feeds the spin-event winner picker: a preselected winner must already appear here.',
  })
  @ApiOkList(VipResponseDto)
  @ApiErrors(401, 404, 422)
  eligible(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: VipFilterDto,
  ): Promise<IPaginatedResult<VipResponseDto>> {
    return this.vipService.findEligibleCustomers(actor, id, filters);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('VIP criteria updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Update a VIP criteria (master only)',
    description:
      'Changing thresholdAmount, periodStart or periodEnd rebuilds every qualification for this criteria inline — a list that disagreed with its own criteria until midnight would be worse than a slower request.',
  })
  @ApiOkData(VipCriteriaResponseDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVipCriteriaDto,
  ): Promise<VipCriteriaResponseDto> {
    return this.vipService.updateCriteria(actor, id, dto);
  }

  @Post(':id/recompute')
  @TeamAuth(StaffRole.MASTER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Qualifications recomputed')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Force a rebuild of who qualifies (master only)',
    description: 'For use after data was corrected outside the normal entry flow.',
  })
  @ApiOkData(Object, 'Qualified and removed counts')
  @ApiErrors(401, 403, 404)
  recompute(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ qualified: number; removed: number }> {
    return this.vipService.recompute(actor, id);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('VIP criteria deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete a VIP criteria (master only)' })
  @ApiOkMessage('VIP criteria deleted')
  @ApiErrors(401, 403, 404)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.vipService.removeCriteria(actor, id);
  }
}

/** VIP holders, across every criteria and time frame. */
@ApiTags('VIPs')
@Controller('team/vips')
@TeamAuth()
export class VipsController {
  constructor(private readonly vipService: VipService) {}

  @Get()
  @ResponseMessage('VIPs retrieved successfully')
  @ApiOperation({
    summary: "List VIPs within the actor's scope",
    description:
      'Returns qualifications across every criteria and time frame, so a customer who was a VIP in a past window still appears. Use `activeOnly=true` for the current VIPs — those whose criteria window contains today.',
  })
  @ApiOkList(VipResponseDto)
  @ApiErrors(401, 404, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: VipFilterDto,
  ): Promise<IPaginatedResult<VipResponseDto>> {
    return this.vipService.findVips(actor, filters);
  }
}

/** The customer's own VIP standing. */
@ApiTags('Customer Portal')
@Controller('me')
export class VipPortalController {
  constructor(private readonly vipService: VipService) {}

  @Get('vip-status')
  @CustomerAuth()
  @ResponseMessage('VIP status retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's VIP standing",
    description:
      'Progress against every currently-active criteria, including ones not yet reached, so the customer can see how far off they are. Percent is capped at 100.',
  })
  @ApiOkData(VipStatusDto)
  @ApiErrors(401)
  status(@CurrentCustomer() actor: ICurrentCustomer): Promise<VipStatusDto> {
    return this.vipService.statusFor(actor.id);
  }
}
