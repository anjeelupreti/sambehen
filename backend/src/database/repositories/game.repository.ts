import { Inject, Injectable } from '@nestjs/common';
import { eq, ne, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { games, Game } from '../schema/games.schema';
import { BaseRepository } from './base.repository';

@Injectable()
export class GameRepository extends BaseRepository<typeof games> {
  constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
    super(db, games);
  }

  get searchColumns(): PgColumn[] {
    return [games.name, games.code, games.category];
  }

  get sortableColumns(): Record<string, PgColumn> {
    return {
      name: games.name,
      code: games.code,
      category: games.category,
      isActive: games.isActive,
      createdAt: games.createdAt,
    };
  }

  async findByCode(code: string): Promise<Game | undefined> {
    return this.findOneBy([eq(games.code, code.trim().toUpperCase())]);
  }

  async codeTaken(code: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(games.code, code.trim().toUpperCase())];
    if (excludeId) conditions.push(ne(games.id, excludeId));
    return this.exists(conditions);
  }
}
