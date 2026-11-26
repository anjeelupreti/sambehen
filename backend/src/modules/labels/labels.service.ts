import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { AuthRealm } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  ResourceConflictException,
  ResourceNotFoundException,
  ValidationException,
} from '@common/exceptions/business.exception';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { customerLabelAssignments, customerLabels } from '@database/schema/labels.schema';
import { AuditService } from '@shared/audit/audit.service';
import { ScopeService } from '@shared/scope/scope.service';
import {
  AutoLabel,
  BIG_SPENDER_PERCENTILE,
  isBigSpenderSql,
  isInactiveSql,
  isNewSql,
  isVipSql,
  recentSpendSql,
} from './auto-labels';
import { CreateLabelDto, LabelDto, LabelWithUsageDto, UpdateLabelDto } from './dto/label.dto';

@Injectable()
export class LabelsService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
  ) {}

  /** Every label, with how many of the viewer's players carry it. */
  async list(actor: ICurrentStaff): Promise<LabelWithUsageDto[]> {
    const scope = await this.scopeService.customerScope(actor);
    const visible = and(isNull(customers.deletedAt), scope);
    const rows = await this.db
      .select({
        id: customerLabels.id,
        name: customerLabels.name,
        color: customerLabels.color,
        playerCount: sql<number>`(
          SELECT count(*) FROM ${customerLabelAssignments} a
          JOIN ${customers} ON "customers"."id" = a.customer_id
          WHERE a.label_id = "customer_labels"."id" AND ${visible}
        )`,
      })
      .from(customerLabels)
      .orderBy(asc(sql`lower(${customerLabels.name})`));
    return rows.map((row) => ({ ...row, playerCount: Number(row.playerCount) }));
  }

  async create(actor: ICurrentStaff, dto: CreateLabelDto): Promise<LabelDto> {
    await this.assertNameFree(dto.name);
    const [label] = await this.db
      .insert(customerLabels)
      .values({ name: dto.name, color: dto.color, createdByStaffId: actor.id })
      .returning({ id: customerLabels.id, name: customerLabels.name, color: customerLabels.color });
    await this.audit(actor, 'label.create', label.id, null, label);
    return label;
  }

  async update(actor: ICurrentStaff, id: string, dto: UpdateLabelDto): Promise<LabelDto> {
    const before = await this.find(id);
    if (dto.name && dto.name.toLowerCase() !== before.name.toLowerCase()) {
      await this.assertNameFree(dto.name);
    }
    const [label] = await this.db
      .update(customerLabels)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(customerLabels.id, id))
      .returning({ id: customerLabels.id, name: customerLabels.name, color: customerLabels.color });
    await this.audit(actor, 'label.update', id, before, label);
    return label;
  }

  /** Removes the label and takes it off every player who had it. */
  async remove(actor: ICurrentStaff, id: string): Promise<void> {
    const before = await this.find(id);
    await this.db.delete(customerLabels).where(eq(customerLabels.id, id));
    await this.audit(actor, 'label.delete', id, before, null);
  }

  /** Replaces a player's labels. The player must be one the viewer can see. */
  async setForCustomer(
    actor: ICurrentStaff,
    customerId: string,
    labelIds: string[],
  ): Promise<LabelDto[]> {
    const scope = await this.scopeService.customerScope(actor);
    const [customer] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), isNull(customers.deletedAt), scope));
    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }

    const wanted = [...new Set(labelIds)];
    if (wanted.length) {
      const known = await this.db
        .select({ id: customerLabels.id })
        .from(customerLabels)
        .where(inArray(customerLabels.id, wanted));
      if (known.length !== wanted.length) {
        throw new ValidationException([
          {
            field: 'labelIds',
            constraint: 'exists',
            message: 'One of those labels no longer exists.',
          },
        ]);
      }
    }

    const before = (await this.labelsFor([customerId])).get(customerId) ?? [];
    await this.db.transaction(async (tx) => {
      await tx
        .delete(customerLabelAssignments)
        .where(eq(customerLabelAssignments.customerId, customerId));
      if (wanted.length) {
        await tx
          .insert(customerLabelAssignments)
          .values(wanted.map((labelId) => ({ customerId, labelId, assignedByStaffId: actor.id })));
      }
    });
    const after = (await this.labelsFor([customerId])).get(customerId) ?? [];
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'customer.labels',
      entityType: 'customer',
      entityId: customerId,
      before: { labels: before.map((l) => l.name) },
      after: { labels: after.map((l) => l.name) },
      metadata: null,
    });
    return after;
  }

  /** Manual labels for a set of players, keyed by player id. */
  async labelsFor(customerIds: string[]): Promise<Map<string, LabelDto[]>> {
    const result = new Map<string, LabelDto[]>();
    if (!customerIds.length) return result;
    const rows = await this.db
      .select({
        customerId: customerLabelAssignments.customerId,
        id: customerLabels.id,
        name: customerLabels.name,
        color: customerLabels.color,
      })
      .from(customerLabelAssignments)
      .innerJoin(customerLabels, eq(customerLabels.id, customerLabelAssignments.labelId))
      .where(inArray(customerLabelAssignments.customerId, customerIds))
      .orderBy(asc(sql`lower(${customerLabels.name})`));
    for (const { customerId, ...label } of rows) {
      result.set(customerId, [...(result.get(customerId) ?? []), label]);
    }
    return result;
  }

  /**
   * The money-in level that makes a player a "big spender" for this viewer:
   * the 90th percentile of the last 30 days' money in, among the players
   * they can see who spent anything. Relative, so it works for a small
   * store and a whole chain alike.
   */
  async bigSpenderThreshold(actor: ICurrentStaff): Promise<number> {
    const scope = await this.scopeService.customerScope(actor);
    const where = and(isNull(customers.deletedAt), scope);
    const result = await this.db.execute(sql`
      SELECT percentile_cont(${BIG_SPENDER_PERCENTILE}) WITHIN GROUP (ORDER BY s) AS threshold
      FROM (SELECT ${recentSpendSql} AS s FROM ${customers} WHERE ${where}) spend
      WHERE s > 0
    `);
    const row = (result as unknown as { rows: { threshold: string | null }[] }).rows[0];
    return Number(row?.threshold ?? 0);
  }

  /** Automatic labels for a set of players, keyed by player id. */
  async autoLabelsFor(
    actor: ICurrentStaff,
    customerIds: string[],
  ): Promise<Map<string, AutoLabel[]>> {
    const result = new Map<string, AutoLabel[]>();
    if (!customerIds.length) return result;
    const threshold = await this.bigSpenderThreshold(actor);
    const rows = await this.db
      .select({
        id: customers.id,
        vip: isVipSql,
        isNew: isNewSql,
        bigSpender: isBigSpenderSql(threshold),
        inactive: isInactiveSql,
      })
      .from(customers)
      .where(inArray(customers.id, customerIds));
    for (const row of rows) {
      const labels: AutoLabel[] = [];
      if (row.vip) labels.push(AutoLabel.VIP);
      if (row.bigSpender) labels.push(AutoLabel.BIG_SPENDER);
      if (row.isNew) labels.push(AutoLabel.NEW);
      if (row.inactive) labels.push(AutoLabel.INACTIVE);
      result.set(row.id, labels);
    }
    return result;
  }

  /** SQL that keeps only players carrying a label, for list filters. */
  hasLabelSql(labelId: string): SQL {
    return sql`EXISTS (SELECT 1 FROM ${customerLabelAssignments} a
      WHERE a.customer_id = "customers"."id" AND a.label_id = ${labelId}::uuid)`;
  }

  private async find(id: string) {
    const [label] = await this.db.select().from(customerLabels).where(eq(customerLabels.id, id));
    if (!label) throw new ResourceNotFoundException(ErrorCode.NOT_FOUND, 'Label not found');
    return label;
  }

  private async assertNameFree(name: string): Promise<void> {
    const [taken] = await this.db
      .select({ id: customerLabels.id })
      .from(customerLabels)
      .where(eq(sql`lower(${customerLabels.name})`, name.toLowerCase()));
    if (taken) {
      throw new ResourceConflictException(
        ErrorCode.CONFLICT,
        'A label with that name already exists.',
      );
    }
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'label',
      entityId,
      before: (before as Record<string, unknown>) ?? null,
      after: (after as Record<string, unknown>) ?? null,
      metadata: null,
    });
  }
}
