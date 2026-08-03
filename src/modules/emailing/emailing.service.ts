import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql, SQL } from 'drizzle-orm';
import { AuthRealm, CampaignStatus, RecipientStatus } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import {
  emailCampaigns,
  emailCampaignRecipients,
  EmailCampaign,
} from '@database/schema/email.schema';
import { AuditService } from '@shared/audit/audit.service';
import { EmailKind } from '@shared/mailer/email-template.service';
import { RecipientFilterService } from './recipient-filter.service';
import {
  CreateCampaignDto,
  SendCampaignDto,
  PreviewRecipientsDto,
  CampaignFilterDto,
  CampaignResponseDto,
  CampaignRecipientDto,
  RecipientPreviewDto,
} from './dto/email.dto';

/** Statuses a campaign can still be cancelled from. */
const CANCELLABLE: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.QUEUED,
  CampaignStatus.SENDING,
];

@Injectable()
export class EmailingService {
  private readonly logger = new Logger(EmailingService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly recipientFilterService: RecipientFilterService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Count and sample for a filter, before anything is composed or sent.
   *
   * The single most useful safety net in the whole feature: a sender who
   * can see "412 recipients, 18 excluded" and a handful of names will
   * catch a mis-set filter that a bare Send button would not.
   */
  async previewRecipients(
    actor: ICurrentStaff,
    dto: PreviewRecipientsDto,
  ): Promise<RecipientPreviewDto> {
    const { totalRecipients, excluded, sample } = await this.recipientFilterService.preview(
      actor,
      dto,
      dto.sampleSize ?? 10,
    );

    return { totalRecipients, excluded, sample };
  }

  async createCampaign(actor: ICurrentStaff, dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    const [created] = await this.db
      .insert(emailCampaigns)
      .values({
        subject: dto.subject,
        bodyText: dto.bodyText,
        bodyHtml: dto.bodyHtml,
        emailKind: dto.emailKind ?? EmailKind.PROMOTIONAL,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdByStaffId: actor.id,
        status: CampaignStatus.DRAFT,
      })
      .returning();

    await this.audit(actor, 'email_campaign.create', created.id, undefined, {
      subject: dto.subject,
      scheduledAt: dto.scheduledAt,
    });

    return this.toResponse(created);
  }

  /**
   * Resolves the audience, snapshots it, and queues the campaign.
   *
   * Recipients are written to the database rather than held in memory:
   * that table IS the send queue, so a restart mid-send resumes exactly
   * where it stopped, and "who did this go to" stays answerable months
   * later. The filter is stored alongside, since re-running it would
   * produce a different audience as customers change.
   *
   * Returns immediately. Sending happens on the dispatcher tick.
   */
  async sendCampaign(
    actor: ICurrentStaff,
    campaignId: string,
    dto: SendCampaignDto,
  ): Promise<CampaignResponseDto> {
    const campaign = await this.requireCampaign(campaignId);

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BusinessException(
        ErrorCode.EMAIL_CAMPAIGN_ALREADY_SENT,
        `A campaign in status "${campaign.status}" cannot be sent again`,
      );
    }

    const recipients = await this.recipientFilterService.resolve(actor, dto.filter);

    if (recipients.length === 0) {
      throw new BusinessException(
        ErrorCode.EMAIL_NO_RECIPIENTS,
        'This filter matches no mailable customers',
        undefined,
        { filter: { ...dto.filter } },
      );
    }

    const updated = await this.db.transaction(async (tx) => {
      await tx.insert(emailCampaignRecipients).values(
        recipients.map((recipient) => ({
          campaignId: campaign.id,
          customerId: recipient.customerId,
          email: recipient.email,
          status: RecipientStatus.PENDING,
        })),
      );

      const [row] = await tx
        .update(emailCampaigns)
        .set({
          status: CampaignStatus.QUEUED,
          recipientCount: recipients.length,
          filterSnapshot: { ...dto.filter },
          startedAt: campaign.scheduledAt ? null : new Date(),
        })
        .where(eq(emailCampaigns.id, campaign.id))
        .returning();

      return row;
    });

    await this.audit(actor, 'email_campaign.send', campaign.id, undefined, {
      recipientCount: recipients.length,
      filter: { ...dto.filter },
    });

    this.logger.log(`Campaign ${campaign.id} queued for ${recipients.length} recipient(s)`);
    return this.toResponse(updated);
  }

  /**
   * Cancels a campaign and drops whatever has not gone out.
   *
   * Already-sent messages cannot be recalled, so the campaign keeps its
   * sentCount and the remaining pending rows are removed — cancelling
   * stops future sends rather than pretending the earlier ones did not
   * happen.
   */
  async cancelCampaign(actor: ICurrentStaff, campaignId: string): Promise<CampaignResponseDto> {
    const campaign = await this.requireCampaign(campaignId);

    if (!CANCELLABLE.includes(campaign.status)) {
      throw new BusinessException(
        ErrorCode.EMAIL_CAMPAIGN_NOT_CANCELLABLE,
        `A campaign in status "${campaign.status}" can no longer be cancelled`,
      );
    }

    const updated = await this.db.transaction(async (tx) => {
      const dropped = await tx
        .delete(emailCampaignRecipients)
        .where(
          and(
            eq(emailCampaignRecipients.campaignId, campaignId),
            eq(emailCampaignRecipients.status, RecipientStatus.PENDING),
          ),
        )
        .returning({ id: emailCampaignRecipients.id });

      const [row] = await tx
        .update(emailCampaigns)
        .set({ status: CampaignStatus.CANCELLED, completedAt: new Date() })
        .where(eq(emailCampaigns.id, campaignId))
        .returning();

      this.logger.log(
        `Campaign ${campaignId} cancelled; ${dropped.length} pending send(s) dropped`,
      );
      return row;
    });

    await this.audit(actor, 'email_campaign.cancel', campaignId);
    return this.toResponse(updated);
  }

  async findAll(filters: CampaignFilterDto): Promise<IPaginatedResult<CampaignResponseDto>> {
    const conditions: SQL[] = [isNull(emailCampaigns.deletedAt)];

    if (filters.status) conditions.push(eq(emailCampaigns.status, filters.status));
    if (filters.createdByStaffId) {
      conditions.push(eq(emailCampaigns.createdByStaffId, filters.createdByStaffId));
    }
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(sql`${emailCampaigns.subject} ILIKE ${term}`);
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(emailCampaigns)
        .where(where)
        .orderBy(desc(emailCampaigns.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(emailCampaigns).where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(campaignId: string): Promise<CampaignResponseDto> {
    return this.toResponse(await this.requireCampaign(campaignId));
  }

  /** Per-recipient delivery results, for diagnosing a partial send. */
  async findRecipients(
    campaignId: string,
    page = 1,
    limit = 50,
    status?: RecipientStatus,
  ): Promise<IPaginatedResult<CampaignRecipientDto>> {
    await this.requireCampaign(campaignId);

    const conditions: SQL[] = [eq(emailCampaignRecipients.campaignId, campaignId)];
    if (status) conditions.push(eq(emailCampaignRecipients.status, status));

    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: emailCampaignRecipients.id,
          customerId: emailCampaignRecipients.customerId,
          email: emailCampaignRecipients.email,
          status: emailCampaignRecipients.status,
          error: emailCampaignRecipients.error,
          sentAt: emailCampaignRecipients.sentAt,
        })
        .from(emailCampaignRecipients)
        .where(where)
        .orderBy(desc(emailCampaignRecipients.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(emailCampaignRecipients).where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows as CampaignRecipientDto[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private async requireCampaign(id: string): Promise<EmailCampaign> {
    const [row] = await this.db
      .select()
      .from(emailCampaigns)
      .where(and(eq(emailCampaigns.id, id), isNull(emailCampaigns.deletedAt)))
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundException(
        ErrorCode.EMAIL_CAMPAIGN_NOT_FOUND,
        'Email campaign not found',
      );
    }
    return row;
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'email_campaign',
      entityId,
      before: before ?? null,
      after: after ?? null,
    });
  }

  private toResponse(campaign: EmailCampaign): CampaignResponseDto {
    return {
      id: campaign.id,
      subject: campaign.subject,
      emailKind: campaign.emailKind,
      status: campaign.status,
      recipientCount: campaign.recipientCount,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      createdByStaffId: campaign.createdByStaffId,
      createdAt: campaign.createdAt,
    };
  }
}
