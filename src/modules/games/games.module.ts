import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameRepository } from '@database/repositories/game.repository';

@Module({
  controllers: [GamesController],
  providers: [GamesService, GameRepository],
  exports: [GamesService, GameRepository],
})
export class GamesModule {}
