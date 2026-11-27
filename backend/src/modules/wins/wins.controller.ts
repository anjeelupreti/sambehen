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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer, CurrentStaff } from '@common/decorators/auth.decorators';
import { CustomerAuth, TeamAuth } from '@common/decorators/composite-auth.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ICurrentCustomer, ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiCreatedData,
  ApiErrors,
  ApiOkData,
  ApiOkList,
  ApiOkMessage,
} from '@common/swagger/api-response.decorators';
import {
  RecordWinDto,
  UpdateWinDto,
  WinDto,
  WinFeedDto,
  WinListQueryDto,
  WinVisibilityDto,
} from './dto/win.dto';
import { WinsService } from './wins.service';

@ApiTags('Wins')
@Controller('team/wins')
@TeamAuth()
export class StaffWinsController {
  constructor(private readonly wins: WinsService) {}

  @Get()
  @ResponseMessage('Wins retrieved')
  @ApiOperation({ summary: 'Recorded wins for the players you can see, newest first' })
  @ApiOkList(WinDto)
  @ApiErrors(401, 422)
  list(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() query: WinListQueryDto,
  ): Promise<IPaginatedResult<WinDto>> {
    return this.wins.list(actor, query);
  }

  @Post()
  @ResponseMessage('Win recorded')
  @ApiOperation({
    summary: 'Record a big win',
    description:
      'Shown to every player in the wins feed by first name and last initial, unless the player turned that off.',
  })
  @ApiCreatedData(WinDto)
  @ApiErrors(401, 404, 422)
  record(@CurrentStaff() actor: ICurrentStaff, @Body() dto: RecordWinDto): Promise<WinDto> {
    return this.wins.record(actor, dto);
  }

  @Patch(':id')
  @ResponseMessage('Win updated')
  @ApiOperation({ summary: 'Hide a win from the feed, or show it again' })
  @ApiOkData(WinDto)
  @ApiErrors(401, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWinDto,
  ): Promise<WinDto> {
    return this.wins.setHidden(actor, id, dto.hidden);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Win deleted')
  @ApiOperation({ summary: 'Delete a win recorded by mistake' })
  @ApiOkMessage()
  @ApiErrors(401, 404)
  async remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.wins.remove(actor, id);
  }
}

@ApiTags('Customer Portal')
@Controller('me/wins')
@CustomerAuth()
export class PlayerWinsController {
  constructor(private readonly wins: WinsService) {}

  @Get()
  @ResponseMessage('Wins retrieved')
  @ApiOperation({
    summary: 'The wins feed',
    description: 'Recent wins and this week’s biggest. Names are first name and last initial only.',
  })
  @ApiOkData(WinFeedDto)
  @ApiErrors(401)
  feed(@CurrentCustomer() actor: ICurrentCustomer): Promise<WinFeedDto> {
    return this.wins.feed(actor.id);
  }

  @Put('visibility')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Saved')
  @ApiOperation({ summary: 'Show or hide your own wins in the feed' })
  @ApiOkMessage()
  @ApiErrors(401, 422)
  async visibility(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() dto: WinVisibilityDto,
  ): Promise<void> {
    await this.wins.setVisibility(actor.id, dto.show);
  }
}
