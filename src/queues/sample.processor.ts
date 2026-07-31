import { Logger } from '@nestjs/common';

export class SampleQueueProcessor {
  private readonly logger = new Logger(SampleQueueProcessor.name);

  /**
   * Processes a job popped from the queue.
   */
  async processJob(jobId: string, data: Record<string, unknown>): Promise<void> {
    this.logger.log(`📥 Processing queue job [${jobId}] with payload:`, JSON.stringify(data));
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`✅ Queue job [${jobId}] processed successfully`);
  }
}
