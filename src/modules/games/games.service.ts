import { Injectable } from '@nestjs/common';
import { eq, SQL } from 'drizzle-orm';
import { AuthRealm, SortOrder } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { GameRepository } from '@database/repositories/game.repository';
import { games, Game } from '@database/schema/games.schema';
import { AuditService } from '@shared/audit/audit.service';
import { CreateGameDto, UpdateGameDto, GameFilterDto, GameResponseDto } from './dto/game.dto';

/**
 * Game catalogue.
 *
 * Not scoped: the catalogue is shared across the whole business, so every
 * staff member reads the same list. Only a master may change it, since
 * renaming or deactivating a game shifts the dashboard top-game metrics
 * for everyone.
 */
@Injectable()
export class GamesService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(actor: ICurrentStaff, dto: CreateGameDto): Promise<GameResponseDto> {
    if (await this.gameRepository.codeTaken(dto.code)) {
      throw new ResourceConflictException(
        ErrorCode.GAME_CODE_TAKEN,
        'A game with this code already exists',
      );
    }

    const created = await this.gameRepository.create({ ...dto, createdByStaffId: actor.id });
    await this.audit(actor, 'game.create', created.id, undefined, { ...dto });
    return this.toResponse(created);
  }

  async findAll(filters: GameFilterDto): Promise<IPaginatedResult<GameResponseDto>> {
    const conditions: SQL[] = [];
    if (filters.isActive !== undefined) conditions.push(eq(games.isActive, filters.isActive));
    if (filters.category) conditions.push(eq(games.category, filters.category));

    const result = await this.gameRepository.findPaginated(filters, {
      conditions,
      searchColumns: this.gameRepository.searchColumns,
      sortableColumns: this.gameRepository.sortableColumns,
      defaultSort: { column: games.name, order: SortOrder.ASC },
    });

    return { ...result, data: result.data.map((row) => this.toResponse(row)) };
  }

  async findOne(id: string): Promise<GameResponseDto> {
    return this.toResponse(await this.require(id));
  }

  async update(actor: ICurrentStaff, id: string, dto: UpdateGameDto): Promise<GameResponseDto> {
    const existing = await this.require(id);
    const updated = await this.gameRepository.update(id, dto);

    await this.audit(
      actor,
      'game.update',
      id,
      { name: existing.name, category: existing.category, isActive: existing.isActive },
      { ...dto },
    );

    return this.toResponse(updated as Game);
  }

  /**
   * Soft-deletes a game.
   *
   * History is preserved: existing transactions keep their gameId, so past
   * top-game figures stay reproducible. The game simply stops accepting
   * new entries.
   */
  async remove(actor: ICurrentStaff, id: string): Promise<null> {
    await this.require(id);
    await this.gameRepository.softDelete(id);
    await this.audit(actor, 'game.delete', id);
    return null;
  }

  private async require(id: string): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new ResourceNotFoundException(ErrorCode.GAME_NOT_FOUND, 'Game not found');
    }
    return game;
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'game',
      entityId,
      before: before ?? null,
      after: after ?? null,
    });
  }

  private toResponse(game: Game): GameResponseDto {
    return {
      id: game.id,
      name: game.name,
      code: game.code,
      category: game.category,
      description: game.description,
      isActive: game.isActive,
      createdAt: game.createdAt,
    };
  }
}
