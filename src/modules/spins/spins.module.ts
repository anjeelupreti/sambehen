import { Module } from '@nestjs/common';
import {
  SpinEventsController,
  TeamRecentWinnersController,
  CustomerRecentWinnersController,
} from './spins.controller';
import { SpinsService } from './spins.service';
import { SpinStatusJob } from './spin-status.job';

@Module({
  controllers: [SpinEventsController, TeamRecentWinnersController, CustomerRecentWinnersController],
  providers: [SpinsService, SpinStatusJob],
  exports: [SpinsService],
})
export class SpinsModule {}
