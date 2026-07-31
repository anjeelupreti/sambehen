import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { vipCriteria } from '@database/schema/vip-criteria.schema';
import { VipQualificationService } from './vip-qualification.service';

/**
 * Nightly repair of VIP qualification drift.
 *
 * Per-transaction evaluation covers the normal path, but it cannot catch
 * everything: a transaction deleted or corrected lowers a total without
 * emitting a creation event, a criteria window can start covering
 * transactions entered earlier, and the event handler deliberately
 * swallows its own failures so a VIP hiccup never fails a data entry.
 *
 * Rebuilding is one set-based statement per criteria, so this is cheap
 * enough to run over everything currently active rather than trying to
 * work out what changed.
 */
@Injectable()
export class VipDriftJob {
  private readonly logger = new Logger(VipDriftJob.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly qualificationService: VipQualificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'vip-drift-recompute' })
  async recomputeActiveCriteria(): Promise<void> {
    // Only currently-active windows. A closed window's qualifications are
    // history and must not silently change after the fact.
    const active = await this.db
      .select()
      .from(vipCriteria)
      .where(
        and(
          isNull(vipCriteria.deletedAt),
          eq(vipCriteria.isActive, true),
          sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
        ),
      );

    if (active.length === 0) {
      this.logger.debug('No currently-active VIP criteria to recompute');
      return;
    }

    let qualified = 0;
    let removed = 0;

    for (const criteria of active) {
      try {
        const result = await this.qualificationService.recomputeCriteria(criteria);
        qualified += result.qualified;
        removed += result.removed;
      } catch (error) {
        // One bad criteria must not stop the rest from being repaired.
        this.logger.error(
          `Drift recompute failed for criteria ${criteria.id} ("${criteria.name}")`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(
      `VIP drift recompute finished: ${active.length} criteria, ${qualified} qualified, ${removed} removed`,
    );
  }
}
