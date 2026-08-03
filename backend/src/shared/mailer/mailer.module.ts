import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { EmailTemplateService } from './email-template.service';

@Global()
@Module({
  providers: [MailerService, EmailTemplateService],
  exports: [MailerService, EmailTemplateService],
})
export class MailerModule {}
