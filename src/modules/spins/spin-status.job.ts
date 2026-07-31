import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';

/**
 * Advances spin-event status on schedule.
 *
 *   scheduled -> live       once the scheduled time passes, while the
 *                           criteria window is still open
 *   live      -> completed  once the criteria window closes
 *
 * Both transitions are set-based UPDATEs driven by the criteria window
 * rather than a per-event timer, so a restart or a missed tick cannot
 * leave an event stuck: the next run simply recomputes from the dates.
 *
 * `cancelled` is never touched — it is a deliberate decision, not a state
 * the clock should be able to undo.
 */
@Injectable()
export class SpinStatusJob {
  private readonly logger = new Logger(SpinStatusJob.name);

  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'spin-status-transitions' })
  async advanceStatuses(): Promise<void> {
    // scheduled -> live
    const toLive = await this.db.execute(sql`
      UPDATE spin_events e
      SET status = 'live', updated_at = NOW()
      FROM vip_criteria c
      WHERE e.vip_criteria_id = c.id
        AND e.deleted_at IS NULL
        AND e.status = 'scheduled'
        AND e.scheduled_at <= NOW()
        AND CURRENT_DATE BETWEEN c.period_start AND c.period_end
      RETURNING e.id
    `);

    // live -> completed, once the window that defined eligibility closes.
    const toCompleted = await this.db.execute(sql`
      UPDATE spin_events e
      SET status = 'completed', updated_at = NOW()
      FROM vip_criteria c
      WHERE e.vip_criteria_id = c.id
        AND e.deleted_at IS NULL
        AND e.status IN ('scheduled', 'live')
        AND CURRENT_DATE > c.period_end
      RETURNING e.id
    `);

    const live = toLive.rowCount ?? 0;
    const completed = toCompleted.rowCount ?? 0;

    if (live > 0 || completed > 0) {
      this.logger.log(`Spin status transitions: ${live} -> live, ${completed} -> completed`);
    }
  }
}
