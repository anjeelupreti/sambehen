import { Module } from '@nestjs/common';
import {
  SpinEventsController,
  TeamSpinWinnersController,
  TeamRecentWinnersController,
  CustomerRecentWinnersController,
} from './spins.controller';
import { SpinsService } from './spins.service';
import { SpinStatusJob } from './spin-status.job';

@Module({
  controllers: [
    SpinEventsController,
    TeamSpinWinnersController,
    TeamRecentWinnersController,
    CustomerRecentWinnersController,
  ],
  providers: [SpinsService, SpinStatusJob],
  exports: [SpinsService],
})
export class SpinsModule {}
