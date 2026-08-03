import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff, CurrentCustomer, Public } from '@common/decorators/auth.decorators';
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
import { ReferralsService } from './referrals.service';
import {
  CreateReferralProgramDto,
  UpdateReferralProgramDto,
  AssignReferralCodesDto,
  ReferralProgramFilterDto,
  ReferralFilterDto,
  ReferralProgramResponseDto,
  ReferralCodeResponseDto,
  ReferralResponseDto,
  ReferralSummaryDto,
  MyReferralDto,
  PublicReferralDto,
} from './dto/referral.dto';

/**
 * Referral programs — the bonus setup.
 *
 * Master-only: a program decides how much money leaves the business per
 * signup, and codes issued under it are honoured for their lifetime.
 */
@ApiTags('Referral Programs')
@Controller('team/referral-programs')
@TeamAuth()
export class ReferralProgramsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Referral program created successfully')
  @ApiOperation({
    summary: 'Create a referral program (master only)',
    description:
      'Defines what a referral is worth and what the referee must deposit to earn it. Only debits count towards the threshold — a credit paid back out must not keep someone qualified.',
  })
  @ApiCreatedData(ReferralProgramResponseDto, 'Referral program created')
  @ApiErrors(401, 403, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateReferralProgramDto,
  ): Promise<ReferralProgramResponseDto> {
    return this.referralsService.createProgram(actor, dto);
  }

  @Get()
  @ResponseMessage('Referral programs retrieved successfully')
  @ApiOperation({
    summary: 'List referral programs',
    description: 'Use `currentlyValid=true` for programs active and inside their window today.',
  })
  @ApiOkList(ReferralProgramResponseDto)
  @ApiErrors(401, 422)
  findAll(
    @Query() filters: ReferralProgramFilterDto,
  ): Promise<IPaginatedResult<ReferralProgramResponseDto>> {
    return this.referralsService.findAllPrograms(filters);
  }

  @Get(':id')
  @ResponseMessage('Referral program retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a referral program' })
  @ApiOkData(ReferralProgramResponseDto)
  @ApiErrors(401, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ReferralProgramResponseDto> {
    return this.referralsService.findProgram(id);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Referral program updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Update a referral program (master only)',
    description:
      'Bonus changes apply to future rewards only. Amounts already granted are copied onto the referral row and are never rewritten.',
  })
  @ApiOkData(ReferralProgramResponseDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferralProgramDto,
  ): Promise<ReferralProgramResponseDto> {
    return this.referralsService.updateProgram(actor, id, dto);
  }

  @Post(':id/assign')
  @TeamAuth(StaffRole.MASTER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Referral codes assigned successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Issue codes to selected customers (master only)',
    description:
      "The master chooses who is eligible, so a code is always deliberately granted rather than self-generated. Customers who already hold a code for this program are skipped rather than issued a second shareable link. Ids outside the actor's scope are dropped.",
  })
  @ApiOkData(Object, 'Issued codes and skipped count')
  @ApiErrors(401, 403, 404, 422)
  assign(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReferralCodesDto,
  ): Promise<{ issued: ReferralCodeResponseDto[]; skipped: number }> {
    return this.referralsService.assignCodes(actor, id, dto);
  }

  @Get(':id/codes')
  @ResponseMessage('Referral codes retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Codes issued under this program',
    description: 'Scoped: a manager sees only codes held by their own chain.',
  })
  @ApiOkList(ReferralCodeResponseDto)
  @ApiErrors(401, 404, 422)
  codes(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<IPaginatedResult<ReferralCodeResponseDto>> {
    return this.referralsService.findCodes(actor, id, Number(page) || 1, Number(limit) || 25);
  }
}

/** Referral redemptions. */
@ApiTags('Referrals')
@Controller('team/referrals')
@TeamAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @ResponseMessage('Referrals retrieved successfully')
  @ApiOperation({
    summary: "List referrals within the actor's scope",
    description:
      'Scoped through the REFEREE — a referral belongs to whoever owns the customer that was brought in. `summary` reports counts by status and total bonus granted over the whole filtered set.',
  })
  @ApiOkList(ReferralResponseDto, ReferralSummaryDto)
  @ApiErrors(401, 404, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: ReferralFilterDto,
  ): Promise<IPaginatedResult<ReferralResponseDto, ReferralSummaryDto>> {
    return this.referralsService.findReferrals(actor, filters);
  }
}

/** Public link resolution, for the signup page. */
@ApiTags('Referrals')
@Controller('public/referral')
export class PublicReferralController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get(':codeOrSlug')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ResponseMessage('Referral resolved successfully')
  @ApiParam({ name: 'codeOrSlug', description: 'Either the typed code or the link slug.' })
  @ApiOperation({
    summary: 'Resolve a referral code or link',
    description:
      'Unauthenticated, for the signup page. Returns only what a prospective customer needs — program name, what they receive, what they must deposit — and never reveals who owns the code. Throttled, since it is a public lookup by guessable identifier.',
  })
  @ApiOkData(PublicReferralDto)
  @ApiErrors(404, 429)
  resolve(@Param('codeOrSlug') codeOrSlug: string): Promise<PublicReferralDto> {
    return this.referralsService.resolvePublic(codeOrSlug);
  }
}

/** The customer's own referral code and earnings. */
@ApiTags('Customer Portal')
@Controller('me')
export class MyReferralController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('referral')
  @CustomerAuth()
  @ResponseMessage('Referral details retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's referral code, link and earnings",
    description:
      'Returns nulls when no code has been issued: codes are granted by a master, not generated on demand.',
  })
  @ApiOkData(MyReferralDto)
  @ApiErrors(401)
  myReferral(@CurrentCustomer() actor: ICurrentCustomer): Promise<MyReferralDto> {
    return this.referralsService.myReferral(actor.id);
  }
}
