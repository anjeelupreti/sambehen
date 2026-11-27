import { Global, Module } from '@nestjs/common';
import {
  PlayerNotificationsController,
  StaffNotificationsController,
} from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [StaffNotificationsController, PlayerNotificationsController],
  providers: [NotificationsService, NotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
