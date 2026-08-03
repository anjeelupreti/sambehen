import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StaffRole, RecipientStatus } from '@common/constants/app.constants';
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
import { EmailingService } from './emailing.service';
import {
  CreateCampaignDto,
  SendCampaignDto,
  PreviewRecipientsDto,
  CampaignFilterDto,
  CampaignResponseDto,
  CampaignRecipientDto,
  RecipientPreviewDto,
} from './dto/email.dto';

/**
 * Email campaigns.
 *
 * Restricted to master and manager: a campaign reaches customers directly
 * and cannot be recalled once sent.
 *
 * Recipient selection is always intersected with the actor's scope, so a
 * manager cannot mail another chain's customers even by naming their ids
 * explicitly.
 */
@ApiTags('Email')
@Controller('team/email')
@TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
export class EmailingController {
  constructor(private readonly emailingService: EmailingService) {}

  @Post('recipients/preview')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Recipients previewed successfully')
  @ApiOperation({
    summary: 'Count and sample the audience before composing',
    description: [
      'Returns how many customers a filter selects, how many of those are excluded',
      'from sending (no address, opted out, previously bounced), and a sample so the',
      'sender can sanity-check the audience.',
      '',
      'Worth calling every time: a mis-set filter is far cheaper to catch here than',
      'after the messages have gone out.',
    ].join(' '),
  })
  @ApiOkData(RecipientPreviewDto)
  @ApiErrors(401, 403, 422)
  preview(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: PreviewRecipientsDto,
  ): Promise<RecipientPreviewDto> {
    return this.emailingService.previewRecipients(actor, dto);
  }

  @Post('campaigns')
  @ResponseMessage('Campaign created successfully')
  @ApiOperation({
    summary: 'Create a draft campaign',
    description: 'Composes the message only. Recipients are chosen at send time.',
  })
  @ApiCreatedData(CampaignResponseDto, 'Campaign created')
  @ApiErrors(401, 403, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.emailingService.createCampaign(actor, dto);
  }

  @Post('campaigns/:id/send')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Campaign queued successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Resolve the audience and queue the campaign',
    description: [
      'Snapshots the recipients into the database and returns immediately; a background',
      'dispatcher does the sending. That table is the queue, so a restart mid-send',
      'resumes exactly where it stopped and "who did this go to" stays answerable later.',
      '',
      'The filter is stored alongside, because re-running it would produce a different',
      'audience as customers change.',
    ].join(' '),
  })
  @ApiOkData(CampaignResponseDto, 'Campaign queued')
  @ApiErrors(401, 403, 404, 422)
  send(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.emailingService.sendCampaign(actor, id, dto);
  }

  @Post('campaigns/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Campaign cancelled')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Cancel a campaign',
    description:
      'Drops everything still pending. Messages already sent cannot be recalled, so the campaign keeps its sentCount rather than pretending they did not happen.',
  })
  @ApiOkData(CampaignResponseDto)
  @ApiErrors(401, 403, 404, 422)
  cancel(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampaignResponseDto> {
    return this.emailingService.cancelCampaign(actor, id);
  }

  @Get('campaigns')
  @ResponseMessage('Campaigns retrieved successfully')
  @ApiOperation({ summary: 'List campaigns' })
  @ApiOkList(CampaignResponseDto)
  @ApiErrors(401, 403, 422)
  findAll(@Query() filters: CampaignFilterDto): Promise<IPaginatedResult<CampaignResponseDto>> {
    return this.emailingService.findAll(filters);
  }

  @Get('campaigns/:id')
  @ResponseMessage('Campaign retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a campaign' })
  @ApiOkData(CampaignResponseDto)
  @ApiErrors(401, 403, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignResponseDto> {
    return this.emailingService.findOne(id);
  }

  @Get('campaigns/:id/recipients')
  @ResponseMessage('Recipients retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RecipientStatus,
    description: 'Filter by delivery outcome. Use `failed` to diagnose a partial send.',
  })
  @ApiOperation({
    summary: 'Per-recipient delivery results',
    description:
      'Each row carries its own status, provider message id and error, so a partial send can be diagnosed address by address.',
  })
  @ApiOkList(CampaignRecipientDto)
  @ApiErrors(401, 403, 404, 422)
  recipients(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: RecipientStatus,
  ): Promise<IPaginatedResult<CampaignRecipientDto>> {
    return this.emailingService.findRecipients(id, Number(page) || 1, Number(limit) || 50, status);
  }
}
