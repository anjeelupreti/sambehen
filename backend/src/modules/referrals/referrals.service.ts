import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, inArray, isNull, sql, SQL } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { AuthRealm, ReferralStatus } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import {
  referralPrograms,
  referralCodes,
  referrals,
  bonusLedger,
  ReferralProgram,
} from '@database/schema/referrals.schema';
import { customers } from '@database/schema/customers.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import {
  CreateReferralProgramDto,
  UpdateReferralProgramDto,
  AssignReferralCodesDto,
  ReferralProgramFilterDto,
  ReferralFilterDto,
  ReferralProgramResponseDto,
  ReferralCodeResponseDto,
  ReferralResponseDto,
  ReferralSummaryDto,
  MyReferralDto,
  PublicReferralDto,
} from './dto/referral.dto';

/**
 * Code alphabet excluding O/0, I/1 and similar look-alikes.
 *
 * Referral codes get read aloud, written down and re-typed, so an
 * ambiguous character is a support ticket waiting to happen.
 */
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
/** Link slugs are not typed by hand, so the full alphabet is fine. */
const generateSlug = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  12,
);

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  // ── Programs ────────────────────────────────────────────────

  async createProgram(
    actor: ICurrentStaff,
    dto: CreateReferralProgramDto,
  ): Promise<ReferralProgramResponseDto> {
    if (dto.validTo && new Date(dto.validTo) < new Date(dto.validFrom)) {
      throw new BusinessException(
        ErrorCode.VIP_INVALID_PERIOD,
        'validTo must be on or after validFrom',
      );
    }

    const [created] = await this.db
      .insert(referralPrograms)
      .values({
        name: dto.name,
        description: dto.description,
        rewardType: dto.rewardType,
        referrerBonus: dto.referrerBonus,
        refereeBonus: dto.refereeBonus,
        minQualifyingDebit: dto.minQualifyingDebit ?? '0.00',
        maxRewardsPerReferrer: dto.maxRewardsPerReferrer,
        validFrom: dto.validFrom,
        validTo: dto.validTo,
        createdByStaffId: actor.id,
      })
      .returning();

    await this.audit(actor, 'referral_program.create', created.id, undefined, { ...dto });
    return this.toProgramResponse(created, 0);
  }

  async findAllPrograms(
    filters: ReferralProgramFilterDto,
  ): Promise<IPaginatedResult<ReferralProgramResponseDto>> {
    const conditions: SQL[] = [isNull(referralPrograms.deletedAt)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(referralPrograms.isActive, filters.isActive));
    }
    if (filters.currentlyValid) {
      conditions.push(
        eq(referralPrograms.isActive, true),
        sql`${referralPrograms.validFrom} <= CURRENT_DATE`,
        sql`(${referralPrograms.validTo} IS NULL OR ${referralPrograms.validTo} >= CURRENT_DATE)`,
      );
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          program: referralPrograms,
          issuedCodes: sql<number>`(
            SELECT COUNT(*) FROM ${referralCodes}
            WHERE ${referralCodes.programId} = ${referralPrograms.id}
          )`,
        })
        .from(referralPrograms)
        .where(where)
        .orderBy(desc(referralPrograms.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(referralPrograms).where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toProgramResponse(row.program, Number(row.issuedCodes))),
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

  async findProgram(id: string): Promise<ReferralProgramResponseDto> {
    const program = await this.requireProgram(id);
    const [row] = await this.db
      .select({ value: count() })
      .from(referralCodes)
      .where(eq(referralCodes.programId, id));

    return this.toProgramResponse(program, Number(row?.value ?? 0));
  }

  async updateProgram(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateReferralProgramDto,
  ): Promise<ReferralProgramResponseDto> {
    const existing = await this.requireProgram(id);

    const [updated] = await this.db
      .update(referralPrograms)
      .set({ ...dto })
      .where(eq(referralPrograms.id, id))
      .returning();

    await this.audit(
      actor,
      'referral_program.update',
      id,
      { referrerBonus: existing.referrerBonus, refereeBonus: existing.refereeBonus },
      { ...dto },
    );

    return this.toProgramResponse(updated, 0);
  }

  // ── Code assignment ─────────────────────────────────────────

  /**
   * Issues codes to the selected customers.
   *
   * The master chooses who is eligible, so a code is always deliberately
   * granted rather than self-generated. Re-assigning to a customer who
   * already has one for this program returns the existing code instead of
   * minting a second, which would leave them with two shareable links.
   */
  async assignCodes(
    actor: ICurrentStaff,
    programId: string,
    dto: AssignReferralCodesDto,
  ): Promise<{ issued: ReferralCodeResponseDto[]; skipped: number }> {
    const program = await this.requireProgram(programId);

    // Ids are intersected with scope, so a manager cannot issue codes to
    // another chain's customers.
    const scope = await this.scopeService.customerScope(actor);
    const conditions: SQL[] = [inArray(customers.id, dto.ids), isNull(customers.deletedAt)];
    if (scope) conditions.push(scope);

    const permitted = await this.db
      .select({ id: customers.id, username: customers.username })
      .from(customers)
      .where(and(...conditions));

    const existing = await this.db
      .select({ customerId: referralCodes.customerId })
      .from(referralCodes)
      .where(
        and(
          eq(referralCodes.programId, programId),
          inArray(
            referralCodes.customerId,
            permitted.map((c) => c.id),
          ),
        ),
      );

    const alreadyIssued = new Set(existing.map((row) => row.customerId));
    const toIssue = permitted.filter((customer) => !alreadyIssued.has(customer.id));

    const issued: ReferralCodeResponseDto[] = [];

    for (const customer of toIssue) {
      const [row] = await this.db
        .insert(referralCodes)
        .values({
          customerId: customer.id,
          programId,
          code: await this.uniqueCode(),
          linkSlug: generateSlug(),
          maxUses: dto.maxUses,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          assignedByStaffId: actor.id,
        })
        .returning();

      issued.push(this.toCodeResponse(row, customer.username));
    }

    await this.audit(actor, 'referral_code.assign', programId, undefined, {
      programName: program.name,
      requested: dto.ids.length,
      issued: issued.length,
      skipped: dto.ids.length - issued.length,
    });

    return { issued, skipped: dto.ids.length - issued.length };
  }

  /** Codes issued under a program, scoped to the actor. */
  async findCodes(
    actor: ICurrentStaff,
    programId: string,
    page = 1,
    limit = 25,
  ): Promise<IPaginatedResult<ReferralCodeResponseDto>> {
    const scope = await this.scopeService.customerScope(actor);
    const conditions: SQL[] = [eq(referralCodes.programId, programId)];
    if (scope) conditions.push(scope);

    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({ code: referralCodes, username: customers.username })
        .from(referralCodes)
        .innerJoin(customers, eq(referralCodes.customerId, customers.id))
        .where(where)
        .orderBy(desc(referralCodes.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(referralCodes)
        .innerJoin(customers, eq(referralCodes.customerId, customers.id))
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toCodeResponse(row.code, row.username)),
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

  // ── Redemption ──────────────────────────────────────────────

  /**
   * Resolves a shared link or typed code to its program details.
   *
   * Public and unauthenticated, so it returns only what a prospective
   * customer needs to decide: the program name, what they get, and what
   * they must do. It never reveals who owns the code.
   */
  async resolvePublic(codeOrSlug: string): Promise<PublicReferralDto> {
    const [row] = await this.db
      .select({ code: referralCodes, program: referralPrograms })
      .from(referralCodes)
      .innerJoin(referralPrograms, eq(referralCodes.programId, referralPrograms.id))
      .where(
        sql`(${referralCodes.code} = ${codeOrSlug.toUpperCase()} OR ${referralCodes.linkSlug} = ${codeOrSlug})`,
      )
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundException(
        ErrorCode.REFERRAL_CODE_NOT_FOUND,
        'Referral code not found',
      );
    }

    return {
      code: row.code.code,
      programName: row.program.name,
      refereeBonus: row.program.refereeBonus,
      minQualifyingDebit: row.program.minQualifyingDebit,
      isValid: this.codeIsUsable(row.code, row.program),
    };
  }

  /**
   * Links a newly created customer to the code they arrived through.
   *
   * Called by the customers module at creation time. Returns silently when
   * the code is unusable rather than failing the customer creation: a
   * stale link must not block a legitimate signup that staff are keying in.
   */
  async attachReferral(refereeCustomerId: string, codeOrSlug: string): Promise<void> {
    const [row] = await this.db
      .select({ code: referralCodes, program: referralPrograms })
      .from(referralCodes)
      .innerJoin(referralPrograms, eq(referralCodes.programId, referralPrograms.id))
      .where(
        sql`(${referralCodes.code} = ${codeOrSlug.toUpperCase()} OR ${referralCodes.linkSlug} = ${codeOrSlug})`,
      )
      .limit(1);

    if (!row || !this.codeIsUsable(row.code, row.program)) {
      this.logger.warn(`Referral code "${codeOrSlug}" is unusable; signup proceeds without it`);
      return;
    }

    if (row.code.customerId === refereeCustomerId) {
      throw new BusinessException(
        ErrorCode.REFERRAL_SELF_REFERRAL,
        'A customer cannot refer themselves',
      );
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(referrals).values({
        codeId: row.code.id,
        programId: row.program.id,
        referrerCustomerId: row.code.customerId,
        refereeCustomerId,
        status: ReferralStatus.PENDING,
      });

      await tx
        .update(referralCodes)
        .set({ usageCount: sql`${referralCodes.usageCount} + 1` })
        .where(eq(referralCodes.id, row.code.id));

      await tx
        .update(customers)
        .set({ referredByCustomerId: row.code.customerId })
        .where(eq(customers.id, refereeCustomerId));
    });
  }

  // ── Referral lists ──────────────────────────────────────────

  async findReferrals(
    actor: ICurrentStaff,
    filters: ReferralFilterDto,
  ): Promise<IPaginatedResult<ReferralResponseDto, ReferralSummaryDto>> {
    const conditions: SQL[] = [];

    // Scoped through the REFEREE: the referral belongs to whoever owns the
    // customer that was brought in.
    const scope = await this.scopeService.customerScope(actor, {
      managerId: filters.managerId,
      storeId: filters.storeId,
    });
    if (scope) {
      conditions.push(
        sql`${referrals.refereeCustomerId} IN (
          SELECT ${customers.id} FROM ${customers} WHERE ${scope}
        )`,
      );
    }

    if (filters.status) conditions.push(eq(referrals.status, filters.status));
    if (filters.programId) conditions.push(eq(referrals.programId, filters.programId));
    if (filters.referrerCustomerId) {
      conditions.push(eq(referrals.referrerCustomerId, filters.referrerCustomerId));
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow], [summaryRow]] = await Promise.all([
      this.db
        .select({
          id: referrals.id,
          programId: referrals.programId,
          programName: referralPrograms.name,
          referrerCustomerId: referrals.referrerCustomerId,
          refereeCustomerId: referrals.refereeCustomerId,
          refereeUsername: customers.username,
          status: referrals.status,
          referrerReward: referrals.referrerReward,
          refereeReward: referrals.refereeReward,
          rewardedAt: referrals.rewardedAt,
          createdAt: referrals.createdAt,
        })
        .from(referrals)
        .innerJoin(referralPrograms, eq(referrals.programId, referralPrograms.id))
        .innerJoin(customers, eq(referrals.refereeCustomerId, customers.id))
        .where(where)
        .orderBy(desc(referrals.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(referrals).where(where),
      this.db
        .select({
          totalReferrals: count(),
          pending: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'pending')`,
          rewarded: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'rewarded')`,
          rejected: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'rejected')`,
          totalRewarded: sql<string>`COALESCE(SUM(
            COALESCE(${referrals.referrerReward}, 0) + COALESCE(${referrals.refereeReward}, 0)
          ), 0)::text`,
        })
        .from(referrals)
        .where(where),
    ]);

    // Referrer usernames for the page only.
    const referrerIds = [...new Set(rows.map((r) => r.referrerCustomerId))];
    const referrerNames = referrerIds.length
      ? new Map(
          (
            await this.db
              .select({ id: customers.id, username: customers.username })
              .from(customers)
              .where(inArray(customers.id, referrerIds))
          ).map((r) => [r.id, r.username]),
        )
      : new Map<string, string>();

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => ({
        ...row,
        referrerUsername: referrerNames.get(row.referrerCustomerId) ?? null,
      })) as ReferralResponseDto[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalReferrals: Number(summaryRow?.totalReferrals ?? 0),
        pending: Number(summaryRow?.pending ?? 0),
        rewarded: Number(summaryRow?.rewarded ?? 0),
        rejected: Number(summaryRow?.rejected ?? 0),
        totalRewarded: summaryRow?.totalRewarded ?? '0',
      },
    };
  }

  /** The customer's own code, link and earnings. */
  async myReferral(customerId: string): Promise<MyReferralDto> {
    const [codeRow] = await this.db
      .select({ code: referralCodes, program: referralPrograms })
      .from(referralCodes)
      .innerJoin(referralPrograms, eq(referralCodes.programId, referralPrograms.id))
      .where(and(eq(referralCodes.customerId, customerId), eq(referralCodes.isActive, true)))
      .orderBy(desc(referralCodes.createdAt))
      .limit(1);

    const [stats] = await this.db
      .select({
        totalReferred: count(),
        totalRewarded: sql<number>`count(*) FILTER (WHERE ${referrals.status} = 'rewarded')`,
      })
      .from(referrals)
      .where(eq(referrals.referrerCustomerId, customerId));

    const [earned] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${bonusLedger.amount}), 0)::text`,
      })
      .from(bonusLedger)
      .where(
        and(eq(bonusLedger.customerId, customerId), eq(bonusLedger.reason, 'referral_referrer')),
      );

    const [customer] = await this.db
      .select({ bonusBalance: customers.bonusBalance })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return {
      code: codeRow?.code.code ?? null,
      referralLink: codeRow ? this.buildLink(codeRow.code.linkSlug) : null,
      programName: codeRow?.program.name ?? null,
      referrerBonus: codeRow?.program.referrerBonus ?? null,
      totalReferred: Number(stats?.totalReferred ?? 0),
      totalRewarded: Number(stats?.totalRewarded ?? 0),
      totalEarned: earned?.total ?? '0',
      bonusBalance: customer?.bonusBalance ?? '0.00',
    };
  }

  // ── Internals ───────────────────────────────────────────────

  /** Retries on the vanishingly rare collision rather than failing. */
  private async uniqueCode(attempts = 5): Promise<string> {
    for (let i = 0; i < attempts; i += 1) {
      const candidate = generateCode();
      const [existing] = await this.db
        .select({ id: referralCodes.id })
        .from(referralCodes)
        .where(eq(referralCodes.code, candidate))
        .limit(1);

      if (!existing) return candidate;
    }

    throw new BusinessException(
      ErrorCode.INTERNAL_ERROR,
      'Could not generate a unique referral code',
    );
  }

  private codeIsUsable(code: typeof referralCodes.$inferSelect, program: ReferralProgram): boolean {
    const today = new Date().toISOString().slice(0, 10);

    if (!code.isActive || !program.isActive || program.deletedAt) return false;
    if (code.expiresAt && code.expiresAt.getTime() < Date.now()) return false;
    if (code.maxUses !== null && code.usageCount >= code.maxUses) return false;
    if (program.validFrom > today) return false;
    if (program.validTo && program.validTo < today) return false;

    return true;
  }

  private buildLink(slug: string): string {
    const base = this.configService.get<string>(
      'business.referralLinkBaseUrl',
      'http://localhost:3000/r',
    );
    return `${base.replace(/\/$/, '')}/${slug}`;
  }

  private async requireProgram(id: string): Promise<ReferralProgram> {
    const [program] = await this.db
      .select()
      .from(referralPrograms)
      .where(and(eq(referralPrograms.id, id), isNull(referralPrograms.deletedAt)))
      .limit(1);

    if (!program) {
      throw new ResourceNotFoundException(
        ErrorCode.REFERRAL_PROGRAM_NOT_FOUND,
        'Referral program not found',
      );
    }
    return program;
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
      entityType: 'referral_program',
      entityId,
      before: before ?? null,
      after: after ?? null,
    });
  }

  private toProgramResponse(
    program: ReferralProgram,
    issuedCodes: number,
  ): ReferralProgramResponseDto {
    const today = new Date().toISOString().slice(0, 10);

    return {
      id: program.id,
      name: program.name,
      description: program.description,
      rewardType: program.rewardType,
      referrerBonus: program.referrerBonus,
      refereeBonus: program.refereeBonus,
      minQualifyingDebit: program.minQualifyingDebit,
      maxRewardsPerReferrer: program.maxRewardsPerReferrer,
      validFrom: program.validFrom,
      validTo: program.validTo,
      isActive: program.isActive,
      isCurrentlyValid:
        program.isActive &&
        program.validFrom <= today &&
        (!program.validTo || program.validTo >= today),
      issuedCodes,
      createdAt: program.createdAt,
    };
  }

  private toCodeResponse(
    code: typeof referralCodes.$inferSelect,
    username: string | null,
  ): ReferralCodeResponseDto {
    return {
      id: code.id,
      customerId: code.customerId,
      customerUsername: username,
      code: code.code,
      referralLink: this.buildLink(code.linkSlug),
      isActive: code.isActive,
      usageCount: code.usageCount,
      maxUses: code.maxUses,
      expiresAt: code.expiresAt,
    };
  }
}
