import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiCreatedData,
  ApiErrors,
  ApiOkArray,
  ApiOkData,
  ApiOkMessage,
} from '@common/swagger/api-response.decorators';
import {
  CreateLabelDto,
  LabelDto,
  LabelWithUsageDto,
  SetCustomerLabelsDto,
  UpdateLabelDto,
} from './dto/label.dto';
import { LabelsService } from './labels.service';

/**
 * Player labels. The master manages the set; every staff member can see
 * it and put labels on the players they can see.
 */
@ApiTags('Labels')
@Controller('team')
@TeamAuth()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get('labels')
  @ResponseMessage('Labels retrieved successfully')
  @ApiOperation({ summary: 'Every label, with how many of your players carry it' })
  @ApiOkArray(LabelWithUsageDto)
  @ApiErrors(401)
  list(@CurrentStaff() actor: ICurrentStaff): Promise<LabelWithUsageDto[]> {
    return this.labelsService.list(actor);
  }

  @Post('labels')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Label created')
  @ApiOperation({ summary: 'Create a label (master only)' })
  @ApiCreatedData(LabelDto)
  @ApiErrors(401, 403, 409, 422)
  create(@CurrentStaff() actor: ICurrentStaff, @Body() dto: CreateLabelDto): Promise<LabelDto> {
    return this.labelsService.create(actor, dto);
  }

  @Patch('labels/:id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Label updated')
  @ApiOperation({ summary: 'Rename or recolour a label (master only)' })
  @ApiOkData(LabelDto)
  @ApiErrors(401, 403, 404, 409, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabelDto,
  ): Promise<LabelDto> {
    return this.labelsService.update(actor, id, dto);
  }

  @Delete('labels/:id')
  @TeamAuth(StaffRole.MASTER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Label deleted')
  @ApiOperation({ summary: 'Delete a label and take it off every player (master only)' })
  @ApiOkMessage()
  @ApiErrors(401, 403, 404)
  async remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.labelsService.remove(actor, id);
  }

  @Put('customers/:id/labels')
  @ResponseMessage('Labels saved')
  @ApiOperation({ summary: "Set a player's labels", description: 'Replaces the full set.' })
  @ApiOkArray(LabelDto)
  @ApiErrors(401, 404, 422)
  setForCustomer(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerLabelsDto,
  ): Promise<LabelDto[]> {
    return this.labelsService.setForCustomer(actor, id, dto.labelIds);
  }
}
