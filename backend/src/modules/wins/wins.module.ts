import { Module } from '@nestjs/common';
import { PlayerWinsController, StaffWinsController } from './wins.controller';
import { WinsService } from './wins.service';

@Module({
  controllers: [StaffWinsController, PlayerWinsController],
  providers: [WinsService],
})
export class WinsModule {}
