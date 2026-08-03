import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
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
import { GamesService } from './games.service';
import { CreateGameDto, UpdateGameDto, GameFilterDto, GameResponseDto } from './dto/game.dto';

/**
 * Game catalogue.
 *
 * Readable by all staff, writable only by a master: renaming or
 * deactivating a game shifts the dashboard top-game metrics for the whole
 * business.
 */
@ApiTags('Games')
@Controller('team/games')
@TeamAuth()
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Game created successfully')
  @ApiOperation({ summary: 'Create a game (master only)' })
  @ApiCreatedData(GameResponseDto, 'Game created')
  @ApiErrors(401, 403, 409, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateGameDto,
  ): Promise<GameResponseDto> {
    return this.gamesService.create(actor, dto);
  }

  @Get()
  @ResponseMessage('Games retrieved successfully')
  @ApiOperation({
    summary: 'List games',
    description: 'Shared catalogue, identical for every staff member. Not scoped.',
  })
  @ApiOkList(GameResponseDto)
  @ApiErrors(401, 422)
  findAll(@Query() filters: GameFilterDto): Promise<IPaginatedResult<GameResponseDto>> {
    return this.gamesService.findAll(filters);
  }

  @Get(':id')
  @ResponseMessage('Game retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get a game' })
  @ApiOkData(GameResponseDto)
  @ApiErrors(401, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GameResponseDto> {
    return this.gamesService.findOne(id);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Game updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Update a game (master only)',
    description: 'Deactivating rejects new transactions but preserves existing history.',
  })
  @ApiOkData(GameResponseDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
  ): Promise<GameResponseDto> {
    return this.gamesService.update(actor, id, dto);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Game deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Soft-delete a game (master only)',
    description:
      'Existing transactions keep their gameId, so historical top-game figures stay reproducible.',
  })
  @ApiOkMessage('Game deleted')
  @ApiErrors(401, 403, 404)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.gamesService.remove(actor, id);
  }
}
