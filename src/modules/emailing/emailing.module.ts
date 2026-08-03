import { Module } from '@nestjs/common';
import { EmailingController } from './emailing.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { EmailingService } from './emailing.service';
import { RecipientFilterService } from './recipient-filter.service';
import { EmailDispatcherJob } from './email-dispatcher.job';

@Module({
  controllers: [EmailingController, UnsubscribeController],
  providers: [EmailingService, RecipientFilterService, EmailDispatcherJob],
  exports: [EmailingService, RecipientFilterService],
})
export class EmailingModule {}
