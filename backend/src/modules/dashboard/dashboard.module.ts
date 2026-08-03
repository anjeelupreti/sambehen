import { Module } from '@nestjs/common';
import { DashboardController, CustomerDashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController, CustomerDashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
