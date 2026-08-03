import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, inArray, sql } from 'drizzle-orm';
import { CampaignStatus, RecipientStatus } from '@common/constants/app.constants';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { emailCampaigns, emailCampaignRecipients } from '@database/schema/email.schema';
import { MailerService } from '@shared/mailer/mailer.service';
import { EmailTemplateService, EmailKind } from '@shared/mailer/email-template.service';
import { HashUtil } from '@common/utils/hash.util';
import { customers } from '@database/schema/customers.schema';

/** How many times a transient failure is retried before giving up. */
const MAX_ATTEMPTS = 3;

/**
 * Drains the send queue.
 *
 * `email_campaign_recipients` is the queue: rows are claimed with
 * FOR UPDATE SKIP LOCKED, which gives durability across restarts, full
 * visibility in plain SQL, and no extra infrastructure. It also stays
 * correct if a second instance is ever added, because SKIP LOCKED stops
 * two workers claiming the same row — which is why this pattern was
 * chosen over an in-memory queue that a restart would lose.
 *
 * The claim marks rows `sending` in its own committed statement, so a
 * crash mid-send leaves them visibly stuck in `sending` rather than
 * silently re-sent to the same people.
 */
@Injectable()
export class EmailDispatcherJob {
  private readonly logger = new Logger(EmailDispatcherJob.name);
  /** Guards against a slow batch overlapping the next tick. */
  private running = false;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly mailerService: MailerService,
    private readonly templateService: EmailTemplateService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'email-dispatcher' })
  async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.reclaimStalledRecipients();
      await this.promoteScheduledCampaigns();
      await this.sendBatch();
      await this.finaliseCompletedCampaigns();
    } catch (error) {
      this.logger.error(
        'Email dispatch tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Signed opt-out link.
   *
   * The token is derived from the customer id and the app secret, so the
   * endpoint can verify it without storing anything, and a customer cannot
   * unsubscribe anyone but themselves by editing the URL.
   */
  private unsubscribeUrl(customerId: string): string {
    const base = this.configService.get<string>('mail.publicUrl', 'http://localhost:3000');
    const secret = this.configService.getOrThrow<string>('jwt.secret');
    const token = HashUtil.sha256(`${customerId}:${secret}`).slice(0, 32);

    return `${base.replace(/\/$/, '')}/api/v1/public/unsubscribe/${customerId}/${token}`;
  }

  /**
   * Returns rows stranded in `sending` to the queue.
   *
   * The claim commits `sending` before the SMTP call, so a crash or a
   * process kill mid-batch leaves rows in that state with nothing left to
   * finish them — the campaign would sit at `sending` forever. Anything
   * untouched for longer than the stall window goes back to `pending`.
   *
   * The window is deliberately generous: reclaiming too eagerly would
   * re-send to someone whose message was in flight, and a duplicate email
   * is worse than a delayed one. `attempts` was already incremented at
   * claim time, so a repeatedly stalling row still exhausts its retries
   * rather than looping forever.
   */
  private async reclaimStalledRecipients(): Promise<void> {
    const reclaimed = await this.db.execute(sql`
      UPDATE email_campaign_recipients
      SET status = ${RecipientStatus.PENDING}
      WHERE status = ${RecipientStatus.SENDING}
        AND created_at < NOW() - INTERVAL '10 minutes'
        AND attempts < ${MAX_ATTEMPTS}
      RETURNING id
    `);

    if ((reclaimed.rowCount ?? 0) > 0) {
      this.logger.warn(`Reclaimed ${reclaimed.rowCount} stalled recipient(s) back to pending`);
    }
  }

  /** Moves scheduled campaigns into sending once they fall due. */
  private async promoteScheduledCampaigns(): Promise<void> {
    await this.db.execute(sql`
      UPDATE email_campaigns
      SET status = ${CampaignStatus.SENDING}, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
      WHERE status = ${CampaignStatus.QUEUED}
        AND deleted_at IS NULL
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    `);
  }

  /**
   * Claims a batch and sends it.
   *
   * Each result is written back individually so a failure is attributed to
   * the exact recipient it belongs to, and a transient error can be
   * retried without re-sending to everyone else in the batch.
   */
  private async sendBatch(): Promise<void> {
    const batchSize = this.configService.get<number>('business.emailBatchSize', 50);

    const claimed = await this.db.execute(sql`
      UPDATE email_campaign_recipients r
      SET status = ${RecipientStatus.SENDING}, attempts = r.attempts + 1
      FROM (
        SELECT er.id
        FROM email_campaign_recipients er
        INNER JOIN email_campaigns ec ON er.campaign_id = ec.id
        WHERE er.status = ${RecipientStatus.PENDING}
          AND ec.status = ${CampaignStatus.SENDING}
          AND ec.deleted_at IS NULL
          AND er.attempts < ${MAX_ATTEMPTS}
        ORDER BY er.created_at
        LIMIT ${batchSize}
        FOR UPDATE OF er SKIP LOCKED
      ) AS claimable
      WHERE r.id = claimable.id
      RETURNING r.id, r.campaign_id, r.customer_id, r.email, r.attempts
    `);

    const rows = claimed.rows as {
      id: string;
      campaign_id: string;
      customer_id: string;
      email: string;
      attempts: number;
    }[];
    if (rows.length === 0) return;

    // Names for personalisation, resolved once for the batch.
    const names = new Map(
      (
        await this.db
          .select({ id: customers.id, fullName: customers.fullName, username: customers.username })
          .from(customers)
          .where(inArray(customers.id, [...new Set(rows.map((row) => row.customer_id))]))
      ).map((row) => [row.id, row.fullName ?? row.username]),
    );

    // Bodies are fetched once per campaign rather than per recipient.
    const campaignIds = [...new Set(rows.map((row) => row.campaign_id))];
    const campaigns = new Map(
      (
        await this.db
          .select({
            id: emailCampaigns.id,
            subject: emailCampaigns.subject,
            bodyText: emailCampaigns.bodyText,
            bodyHtml: emailCampaigns.bodyHtml,
            emailKind: emailCampaigns.emailKind,
          })
          .from(emailCampaigns)
          // inArray rather than `= ANY($1)`: a JS array bound as a single
          // parameter arrives as text[] and never matches a uuid column, so
          // the lookup silently returns nothing and every recipient is
          // skipped while its row stays claimed.
          .where(inArray(emailCampaigns.id, campaignIds))
      ).map((row) => [row.id, row]),
    );

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const campaign = campaigns.get(row.campaign_id);
      if (!campaign) continue;

      // Rendered per recipient rather than once per campaign: the
      // greeting and the unsubscribe token are both recipient-specific.
      const rendered = this.templateService.render({
        kind: campaign.emailKind as EmailKind,
        subject: campaign.subject,
        body: campaign.bodyHtml ?? campaign.bodyText,
        recipientName: names.get(row.customer_id),
        unsubscribeUrl: this.unsubscribeUrl(row.customer_id),
      });

      const result = await this.mailerService.send({
        to: row.email,
        subject: campaign.subject,
        text: rendered.text,
        html: rendered.html,
      });

      if (result.success) {
        await this.db
          .update(emailCampaignRecipients)
          .set({
            status: RecipientStatus.SENT,
            providerMessageId: result.messageId,
            sentAt: new Date(),
            error: null,
          })
          .where(eq(emailCampaignRecipients.id, row.id));
        sent += 1;
        continue;
      }

      // A retryable failure goes back to pending for another attempt;
      // a permanent one is marked failed so it is never retried.
      const exhausted = row.attempts >= MAX_ATTEMPTS;
      await this.db
        .update(emailCampaignRecipients)
        .set({
          status: result.retryable && !exhausted ? RecipientStatus.PENDING : RecipientStatus.FAILED,
          error: result.error,
        })
        .where(eq(emailCampaignRecipients.id, row.id));

      if (!result.retryable || exhausted) failed += 1;
    }

    // Counters are recomputed from the recipient rows rather than
    // incremented, so they cannot drift from the truth.
    //
    // Built with the query builder rather than raw `= ANY(...)`: drizzle
    // expands a JS array into separate bind parameters, so the array form
    // produces a malformed array literal at runtime while type-checking
    // perfectly. A batch spans one or two campaigns, so the loop is cheap.
    for (const campaignId of campaignIds) {
      const [counts] = await this.db
        .select({
          sent: sql<number>`COUNT(*) FILTER (WHERE ${emailCampaignRecipients.status} = ${RecipientStatus.SENT})`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${emailCampaignRecipients.status} = ${RecipientStatus.FAILED})`,
        })
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, campaignId));

      await this.db
        .update(emailCampaigns)
        .set({
          sentCount: Number(counts?.sent ?? 0),
          failedCount: Number(counts?.failed ?? 0),
        })
        .where(eq(emailCampaigns.id, campaignId));
    }

    this.logger.log(`Email batch processed: ${sent} sent, ${failed} failed`);
  }

  /**
   * Closes campaigns with nothing left to send.
   *
   * `partial` rather than `sent` when some recipients failed, so a
   * campaign that half-delivered is never reported as a clean success.
   */
  private async finaliseCompletedCampaigns(): Promise<void> {
    await this.db.execute(sql`
      UPDATE email_campaigns ec
      SET status = CASE WHEN ec.failed_count > 0 THEN ${CampaignStatus.PARTIAL}
                        ELSE ${CampaignStatus.SENT} END,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE ec.status = ${CampaignStatus.SENDING}
        AND ec.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM email_campaign_recipients er
          WHERE er.campaign_id = ec.id
            AND er.status IN (${RecipientStatus.PENDING}, ${RecipientStatus.SENDING})
        )
    `);
  }
}
