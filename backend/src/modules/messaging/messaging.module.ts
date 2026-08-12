import { Module } from '@nestjs/common';
import { MessagingController, CustomerMessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { StaffMessagingController } from './staff-messaging.controller';
import { StaffMessagingService } from './staff-messaging.service';

@Module({
  controllers: [MessagingController, CustomerMessagingController, StaffMessagingController],
  providers: [MessagingService, MessagingGateway, StaffMessagingService],
  exports: [MessagingService, StaffMessagingService],
})
export class MessagingModule {}
