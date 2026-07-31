import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, gte, inArray, isNotNull, isNull, lte, sql, SQL } from 'drizzle-orm';
import {
  AuthRealm,
  SortOrder,
  StaffRole,
  TransactionStatus,
  TransactionType,
} from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  CapabilityDeniedException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { Money } from '@common/utils/money.util';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { TransactionRepository } from '@database/repositories/transaction.repository';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { GameRepository } from '@database/repositories/game.repository';
import { StaffRepository } from '@database/repositories/staff.repository';
import { transactions, Transaction } from '@database/schema/transactions.schema';
import { customers } from '@database/schema/customers.schema';
import { games } from '@database/schema/games.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import {
  CreateTransactionDto,
  CreateCorrectionDto,
  UpdateTransactionDto,
  TransactionFilterDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from './dto/transaction.dto';

/** Emitted after a transaction is committed. Drives VIP and referral recalculation. */
export class TransactionCreatedEvent {
  constructor(
    readonly transactionId: string,
    readonly customerId: string,
    readonly type: TransactionType,
    readonly amount: string,
    readonly occurredAt: Date,
    readonly isCorrection: boolean,
  ) {}
}

export const TRANSACTION_CREATED = 'transaction.created';

/** How far ahead an entry may be dated, allowing for clock skew and timezones. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly transactionRepository: TransactionRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly gameRepository: GameRepository,
    private readonly staffRepository: StaffRepository,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * WHERE clause for a transaction query.
   *
   * Shared by the list, the summary and every export, so an export can
   * never return a row the list would not.
   */
  async buildListConditions(actor: ICurrentStaff, filters: TransactionFilterDto): Promise<SQL[]> {
    const conditions: SQL[] = [isNull(transactions.deletedAt)];

    // Transactions are scoped through their customer: the actor sees a
    // transaction exactly when they can see the customer it belongs to.
    const customerScope = await this.scopeService.customerScope(actor, {
      managerId: filters.managerId,
      runnerId: filters.runnerId,
    });

    if (customerScope) {
      conditions.push(
        sql`${transactions.customerId} IN (
          SELECT ${customers.id} FROM ${customers} WHERE ${customerScope}
        )`,
      );
    }

    if (filters.customerId) conditions.push(eq(transactions.customerId, filters.customerId));
    if (filters.type) conditions.push(eq(transactions.type, filters.type));
    if (filters.status) conditions.push(eq(transactions.status, filters.status));
    if (filters.gameId) conditions.push(eq(transactions.gameId, filters.gameId));
    if (filters.enteredByStaffId) {
      conditions.push(eq(transactions.enteredByStaffId, filters.enteredByStaffId));
    }

    // A correction is a credit WITH a parent; a withdrawal is a credit
    // WITHOUT one. Keeping these distinct is what makes "withdrawn"
    // mean what the business thinks it means.
    if (filters.isCorrection !== undefined) {
      conditions.push(
        filters.isCorrection
          ? isNotNull(transactions.parentTransactionId)
          : isNull(transactions.parentTransactionId),
      );
    }

    if (filters.isWithdrawal) {
      conditions.push(
        eq(transactions.type, TransactionType.CREDIT),
        isNull(transactions.parentTransactionId),
      );
    }

    if (filters.minAmount) conditions.push(gte(transactions.amount, filters.minAmount));
    if (filters.maxAmount) conditions.push(lte(transactions.amount, filters.maxAmount));

    const range = this.dateRange(filters);
    if (range.from) conditions.push(gte(transactions.occurredAt, range.from));
    if (range.to) conditions.push(lte(transactions.occurredAt, range.to));

    return conditions;
  }

  async findAll(
    actor: ICurrentStaff,
    filters: TransactionFilterDto,
  ): Promise<IPaginatedResult<TransactionResponseDto, TransactionSummaryDto>> {
    const conditions = await this.buildListConditions(actor, filters);

    const result = await this.transactionRepository.findPaginated(filters, {
      conditions,
      searchColumns: this.transactionRepository.searchColumns,
      sortableColumns: this.transactionRepository.sortableColumns,
      defaultSort: { column: transactions.occurredAt, order: SortOrder.DESC },
    });

    const labels = await this.resolveLabels(result.data);

    return {
      data: result.data.map((row) => this.toResponse(row, labels)),
      meta: result.meta,
      summary: await this.transactionRepository.totals(conditions),
    };
  }

  async findOne(actor: ICurrentStaff, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.requireScoped(actor, id);
    const labels = await this.resolveLabels([transaction]);
    return this.toResponse(transaction, labels);
  }

  /**
   * Records a transaction.
   *
   * The insert, the customer balance change and the activity timestamp all
   * commit together. Splitting them would leave a window where the ledger
   * and the balance disagree — and the balance is what staff quote to the
   * customer.
   */
  async create(actor: ICurrentStaff, dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    await this.scopeService.assertCanAccessCustomer(actor, dto.customerId);

    const amount = Money.normalise(dto.amount);
    if (!Money.isPositive(amount)) {
      throw new BusinessException(
        ErrorCode.TX_AMOUNT_INVALID,
        'Transaction amount must be greater than zero',
      );
    }

    const occurredAt = dto.occurredAt ?? new Date();
    if (occurredAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      throw new BusinessException(
        ErrorCode.TX_FUTURE_DATED,
        'occurredAt cannot be more than 24 hours in the future',
      );
    }

    if (dto.gameId) await this.requireActiveGame(dto.gameId);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(transactions)
        .values({
          customerId: dto.customerId,
          type: dto.type,
          amount,
          gameId: dto.gameId,
          channel: dto.channel,
          referenceNo: dto.referenceNo,
          note: dto.note,
          occurredAt,
          enteredByStaffId: actor.id,
          status: TransactionStatus.COMPLETED,
        })
        .returning();

      // A debit adds to the balance (money in), a credit subtracts.
      // Computed in SQL so concurrent entries cannot lose an update the
      // way a read-modify-write in application code would.
      const delta = dto.type === TransactionType.DEBIT ? sql`+ ${amount}` : sql`- ${amount}`;
      await tx
        .update(customers)
        .set({
          balance: sql`${customers.balance} ${delta}`,
          lastActivityAt: occurredAt,
        })
        .where(eq(customers.id, dto.customerId));

      return row;
    });

    await this.audit(actor, 'transaction.create', created.id, undefined, {
      customerId: created.customerId,
      type: created.type,
      amount: created.amount,
      gameId: created.gameId,
    });

    // Emitted after commit, so a listener never observes a transaction
    // that later rolls back.
    this.events.emit(
      TRANSACTION_CREATED,
      new TransactionCreatedEvent(
        created.id,
        created.customerId,
        created.type,
        created.amount,
        created.occurredAt,
        false,
      ),
    );

    return this.toResponse(created);
  }

  /**
   * Records a correction against an existing transaction.
   *
   * Always a credit carrying `parentTransactionId`, never an edit of the
   * original. Two consequences the business depends on:
   *   - history stays intact and the fix is visible as a fix
   *   - the row is excluded from `totalWithdrawn`, so correcting a
   *     mis-keyed entry does not look like the customer took money out
   *
   * Corrections against one parent may not exceed its amount in
   * aggregate; otherwise a "fix" would conjure money that was never there.
   */
  async createCorrection(
    actor: ICurrentStaff,
    parentId: string,
    dto: CreateCorrectionDto,
  ): Promise<TransactionResponseDto> {
    const parent = await this.requireScoped(actor, parentId);

    if (parent.parentTransactionId) {
      throw new BusinessException(
        ErrorCode.TX_CORRECTION_ON_CORRECTION,
        'A correction cannot itself be corrected. Correct the original transaction instead.',
      );
    }

    if (parent.status === TransactionStatus.REVERSED) {
      throw new BusinessException(
        ErrorCode.TX_ALREADY_REVERSED,
        'This transaction has already been fully corrected',
      );
    }

    const amount = Money.normalise(dto.amount);
    if (!Money.isPositive(amount)) {
      throw new BusinessException(
        ErrorCode.TX_AMOUNT_INVALID,
        'Correction amount must be greater than zero',
      );
    }

    const alreadyCorrected = await this.transactionRepository.correctedTotal(parentId);
    const remaining = Money.subtract(parent.amount, alreadyCorrected);

    if (Money.isGreaterThan(amount, remaining)) {
      throw new BusinessException(
        ErrorCode.TX_CORRECTION_EXCEEDS_PARENT,
        `Correction exceeds the amount remaining on the parent transaction (${remaining} of ${parent.amount})`,
        undefined,
        {
          parentAmount: parent.amount,
          alreadyCorrected,
          remaining,
          attempted: amount,
        },
      );
    }

    const fullyCorrected = Money.isZero(Money.subtract(remaining, amount));

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(transactions)
        .values({
          customerId: parent.customerId,
          // Always a credit: the database CHECK enforces this too, since a
          // debit correction would silently inflate total_spent.
          type: TransactionType.CREDIT,
          amount,
          gameId: parent.gameId,
          parentTransactionId: parent.id,
          note: dto.reason,
          channel: parent.channel,
          occurredAt: new Date(),
          enteredByStaffId: actor.id,
          status: TransactionStatus.COMPLETED,
        })
        .returning();

      // The correction reverses the parent's effect on the balance.
      const delta = parent.type === TransactionType.DEBIT ? sql`- ${amount}` : sql`+ ${amount}`;
      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} ${delta}` })
        .where(eq(customers.id, parent.customerId));

      if (fullyCorrected) {
        await tx
          .update(transactions)
          .set({ status: TransactionStatus.REVERSED })
          .where(eq(transactions.id, parent.id));
      }

      return row;
    });

    await this.audit(
      actor,
      'transaction.correction',
      created.id,
      { parentAmount: parent.amount, parentStatus: parent.status },
      { amount, reason: dto.reason, parentTransactionId: parent.id },
      { fullyCorrected, alreadyCorrected, remainingBefore: remaining },
    );

    this.events.emit(
      TRANSACTION_CREATED,
      new TransactionCreatedEvent(
        created.id,
        created.customerId,
        created.type,
        created.amount,
        created.occurredAt,
        true,
      ),
    );

    return this.toResponse(created);
  }

  /**
   * Edits a transaction's descriptive fields.
   *
   * Amount, type and customer are deliberately immutable: changing them
   * would silently rewrite every historical aggregate that has already
   * been reported. A wrong amount is fixed with a correction, which leaves
   * an auditable trail.
   */
  async update(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    if (actor.role === StaffRole.RUNNER) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        'Runners cannot edit transactions. Record a correction instead.',
      );
    }

    const existing = await this.requireScoped(actor, id);
    if (dto.gameId) await this.requireActiveGame(dto.gameId);

    const updated = await this.transactionRepository.update(id, dto);

    await this.audit(
      actor,
      'transaction.update',
      id,
      { gameId: existing.gameId, note: existing.note, occurredAt: existing.occurredAt },
      { ...dto },
    );

    return this.toResponse(updated as Transaction);
  }

  /**
   * Soft-deletes a transaction and reverses its balance effect.
   *
   * Master only, and refused when corrections reference it: removing a
   * parent would orphan its corrections and make the withdrawal totals
   * unreconstructable.
   */
  async remove(actor: ICurrentStaff, id: string): Promise<null> {
    if (actor.role !== StaffRole.MASTER) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        'Only a master can delete a transaction. Record a correction instead.',
      );
    }

    const existing = await this.requireScoped(actor, id);

    const corrections = await this.transactionRepository.findCorrections(id);
    if (corrections.length > 0) {
      throw new BusinessException(
        ErrorCode.TX_ALREADY_REVERSED,
        'This transaction has corrections against it and cannot be deleted',
        undefined,
        { correctionCount: corrections.length },
      );
    }

    await this.db.transaction(async (tx) => {
      await tx.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, id));

      const delta =
        existing.type === TransactionType.DEBIT
          ? sql`- ${existing.amount}`
          : sql`+ ${existing.amount}`;
      await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} ${delta}` })
        .where(eq(customers.id, existing.customerId));
    });

    await this.audit(actor, 'transaction.delete', id, {
      customerId: existing.customerId,
      type: existing.type,
      amount: existing.amount,
    });

    return null;
  }

  // ── Internals ───────────────────────────────────────────────

  private async requireScoped(actor: ICurrentStaff, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(id);

    if (!transaction) {
      throw new ResourceNotFoundException(ErrorCode.TX_NOT_FOUND, 'Transaction not found');
    }

    // Scope is checked through the owning customer, so a transaction in
    // another chain is reported as not found rather than forbidden.
    await this.scopeService.assertCanAccessCustomer(actor, transaction.customerId).catch(() => {
      throw new ResourceNotFoundException(ErrorCode.TX_NOT_FOUND, 'Transaction not found');
    });

    return transaction;
  }

  private async requireActiveGame(gameId: string): Promise<void> {
    const game = await this.gameRepository.findById(gameId);

    if (!game) {
      throw new ResourceNotFoundException(ErrorCode.GAME_NOT_FOUND, 'Game not found');
    }
    if (!game.isActive) {
      throw new BusinessException(
        ErrorCode.GAME_INACTIVE,
        'This game is inactive and cannot receive new transactions',
      );
    }
  }

  private dateRange(filters: TransactionFilterDto): { from?: Date; to?: Date } {
    if (filters.lastNDays) {
      return { from: new Date(Date.now() - filters.lastNDays * 86_400_000) };
    }
    return { from: filters.dateFrom, to: filters.dateTo };
  }

  /** Resolves customer, game and staff labels for a page in one round trip each. */
  private async resolveLabels(rows: Transaction[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    if (rows.length === 0) return labels;

    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const gameIds = [...new Set(rows.map((r) => r.gameId).filter((id): id is string => !!id))];
    const staffIds = [...new Set(rows.map((r) => r.enteredByStaffId))];

    const [customerRows, gameRows, staffRows] = await Promise.all([
      this.db
        .select({ id: customers.id, label: customers.username })
        .from(customers)
        .where(inArray(customers.id, customerIds)),
      gameIds.length
        ? this.db
            .select({ id: games.id, label: games.name })
            .from(games)
            .where(inArray(games.id, gameIds))
        : Promise.resolve([]),
      this.db
        .select({ id: staffUsers.id, label: staffUsers.username })
        .from(staffUsers)
        .where(inArray(staffUsers.id, staffIds)),
    ]);

    for (const row of [...customerRows, ...gameRows, ...staffRows]) {
      labels.set(row.id, row.label ?? '');
    }
    return labels;
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId?: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'transaction',
      entityId: entityId ?? null,
      before: before ?? null,
      after: after ?? null,
      metadata: metadata ?? null,
    });
  }

  private toResponse(
    transaction: Transaction,
    labels?: Map<string, string>,
  ): TransactionResponseDto {
    return {
      id: transaction.id,
      customerId: transaction.customerId,
      customerUsername: labels?.get(transaction.customerId) ?? null,
      type: transaction.type,
      amount: transaction.amount,
      gameId: transaction.gameId,
      gameName: transaction.gameId ? (labels?.get(transaction.gameId) ?? null) : null,
      parentTransactionId: transaction.parentTransactionId,
      isCorrection: transaction.parentTransactionId !== null,
      status: transaction.status,
      channel: transaction.channel,
      referenceNo: transaction.referenceNo,
      note: transaction.note,
      occurredAt: transaction.occurredAt,
      enteredByStaffId: transaction.enteredByStaffId,
      enteredByUsername: labels?.get(transaction.enteredByStaffId) ?? null,
      createdAt: transaction.createdAt,
    };
  }
}
