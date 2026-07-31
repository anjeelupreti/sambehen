import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SampleJob {
  private readonly logger = new Logger(SampleJob.name);

  /**
   * Cron job example task method.
   * Can be configured using a cron decorator from @nestjs/schedule if imported.
   */
  execute(): void {
    this.logger.log('⏰ Running sample background cron job');
    // Implement background business logic here
  }
}
