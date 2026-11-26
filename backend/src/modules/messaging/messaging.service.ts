import { Inject, Injectable } from '@nestjs/common';
import { LabelsService } from '@modules/labels/labels.service';
import { isBigSpenderSql, isNewSql, isVipSql } from '@modules/labels/auto-labels';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, inArray, isNull, sql, SQL } from 'drizzle-orm';
import {
  ConversationStatus,
  CustomerStatus,
  MessageSenderType,
} from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  ResourceNotFoundException,
  ValidationException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import {
  conversations,
  messages,
  conversationReadStates,
  Conversation,
} from '@database/schema/messaging.schema';
import { customers } from '@database/schema/customers.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { ScopeService } from '@shared/scope/scope.service';
import {
  SendMessageDto,
  MarkReadDto,
  ConversationFilterDto,
  InboxSort,
  MessageThreadQueryDto,
  ConversationResponseDto,
  ConversationSummaryDto,
  MessageResponseDto,
  MessageAttachmentDto,
  UnreadCountDto,
} from './dto/messaging.dto';

/** Emitted after a message is committed, so the gateway can fan it out. */
export const MESSAGE_CREATED = 'message.created';

export class MessageCreatedEvent {
  constructor(
    readonly message: MessageResponseDto,
    readonly conversationId: string,
    readonly customerId: string,
    readonly managerId: string | null,
    readonly storeId: string | null,
  ) {}
}

export const CONVERSATION_READ = 'conversation.read';

/**
 * Someone caught up on a customer thread. `by` says which side read, so the
 * gateway knows whose ticks to update: the customer's when staff read, the
 * team's when the customer did.
 */
export class ConversationReadEvent {
  constructor(
    readonly conversationId: string,
    readonly customerId: string,
    readonly managerId: string | null,
    readonly storeId: string | null,
    readonly by: 'staff' | 'customer',
    readonly readAt: Date,
  ) {}
}

@Injectable()
export class MessagingService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
    private readonly labelsService: LabelsService,
  ) {}

  /**
   * Unread count for one specific viewer.
   *
   * Counts customer messages newer than that viewer's read marker. This
   * cannot be a column on the conversation: a store, their manager and
   * the master all read the same thread independently, so a message the
   * store has seen is still unread for the master.
   *
   * A viewer with no marker has read nothing, so every customer message
   * counts — which is the correct behaviour for a manager opening an
   * inbox for the first time.
   */
  private unreadExpression(staffId: string): SQL<number> {
    return sql<number>`(
      SELECT COUNT(*) FROM ${messages} m
      WHERE m.conversation_id = ${conversations.id}
        AND m.sender_type = 'customer'
        AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(
          (SELECT rs.last_read_at FROM ${conversationReadStates} rs
           WHERE rs.conversation_id = ${conversations.id}
             AND rs.staff_id = ${staffId}::uuid),
          '-infinity'::timestamptz
        )
    )`;
  }

  /**
   * WHERE clause for the inbox.
   *
   * Shared by the list, the summary and future exports, so all three agree
   * on what the actor can see.
   */
  async buildInboxConditions(actor: ICurrentStaff, filters: ConversationFilterDto): Promise<SQL[]> {
    const conditions: SQL[] = [isNull(customers.deletedAt)];

    // Conversations are scoped through their customer.
    const scope = await this.scopeService.customerScope(actor, {
      managerId: filters.managerId,
      storeId: filters.storeId,
    });
    if (scope) conditions.push(scope);

    if (filters.status) conditions.push(eq(conversations.status, filters.status));
    if (filters.assignedStaffId) {
      conditions.push(eq(conversations.assignedStaffId, filters.assignedStaffId));
    }

    if (filters.todayOnly) {
      conditions.push(sql`${conversations.lastMessageAt}::date = CURRENT_DATE`);
    }

    if (filters.awaitingReply) {
      // The customer spoke last: either staff never replied, or the
      // customer's message is newer than the last staff reply.
      conditions.push(
        sql`${conversations.lastCustomerMessageAt} IS NOT NULL
            AND (${conversations.lastStaffMessageAt} IS NULL
                 OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt})`,
      );
    }

    if (filters.activeCustomersOnly) {
      const windowDays = this.configService.get<number>('business.activeCustomerWindowDays', 30);
      const cutoff = new Date(Date.now() - windowDays * 86_400_000);
      conditions.push(
        eq(customers.status, CustomerStatus.ACTIVE),
        sql`${customers.lastActivityAt} >= ${cutoff}`,
      );
    }

    if (filters.unreadOnly) {
      conditions.push(sql`${this.unreadExpression(actor.id)} > 0`);
    }

    if (filters.vip) conditions.push(isVipSql);
    if (filters.newCustomers) conditions.push(isNewSql);
    if (filters.labelId) conditions.push(this.labelsService.hasLabelSql(filters.labelId));
    if (filters.bigSpenders) {
      conditions.push(isBigSpenderSql(await this.labelsService.bigSpenderThreshold(actor)));
    }

    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        sql`(${customers.username} ILIKE ${term}
             OR ${customers.fullName} ILIKE ${term}
             OR ${customers.email} ILIKE ${term}
             OR EXISTS (SELECT 1 FROM ${messages} m
                        WHERE m.conversation_id = ${conversations.id}
                          AND m.body ILIKE ${term}))`,
      );
    }

    return conditions;
  }

  async findInbox(
    actor: ICurrentStaff,
    filters: ConversationFilterDto,
  ): Promise<IPaginatedResult<ConversationResponseDto, ConversationSummaryDto>> {
    const conditions = await this.buildInboxConditions(actor, filters);
    const where = and(...conditions);
    // The chip counts describe the inbox before any chip is applied, so
    // "VIP (5)" still reads 5 while the "Unread" chip is selected.
    const baseConditions = await this.buildInboxConditions(actor, {
      ...filters,
      unreadOnly: undefined,
      awaitingReply: undefined,
      vip: undefined,
      newCustomers: undefined,
      bigSpenders: undefined,
      labelId: undefined,
    });
    const awaiting = sql`(${conversations.lastCustomerMessageAt} IS NOT NULL
      AND (${conversations.lastStaffMessageAt} IS NULL
           OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt}))`;
    const recent = desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`);
    const order =
      filters.sort === InboxSort.RECENT
        ? [recent]
        : filters.sort === InboxSort.WAITING
          ? [
              desc(awaiting),
              sql`CASE WHEN ${awaiting} THEN ${conversations.lastCustomerMessageAt} END ASC NULLS LAST`,
              recent,
            ]
          : [
              desc(sql`(${this.unreadExpression(actor.id)} > 0)`),
              desc(awaiting),
              sql`CASE WHEN ${awaiting} THEN ${conversations.lastCustomerMessageAt} END ASC NULLS LAST`,
              recent,
            ];

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: conversations.id,
          customerId: conversations.customerId,
          customerUsername: customers.username,
          customerFullName: customers.fullName,
          customerAvatarUrl: customers.avatarUrl,
          status: conversations.status,
          assignedStaffId: conversations.assignedStaffId,
          lastMessagePreview: conversations.lastMessagePreview,
          lastMessageAt: conversations.lastMessageAt,
          messageCount: conversations.messageCount,
          unreadCount: this.unreadExpression(actor.id),
          awaitingReply: sql<boolean>`(
            ${conversations.lastCustomerMessageAt} IS NOT NULL
            AND (${conversations.lastStaffMessageAt} IS NULL
                 OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt})
          )`,
          waitingSince: sql<Date | null>`CASE WHEN ${awaiting} THEN ${conversations.lastCustomerMessageAt} END`,
          managerId: customers.managerId,
          storeId: customers.storeId,
        })
        .from(conversations)
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(conversations)
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    const customerIds = rows.map((row) => row.customerId);
    const [labels, autoLabels] = await Promise.all([
      this.labelsService.labelsFor(customerIds),
      this.labelsService.autoLabelsFor(actor, customerIds),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        unreadCount: Number(row.unreadCount),
        waitingSince: row.waitingSince ? new Date(row.waitingSince) : null,
        labels: labels.get(row.customerId) ?? [],
        autoLabels: autoLabels.get(row.customerId) ?? [],
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: await this.summarise(actor, baseConditions),
    };
  }

  /**
   * Inbox metrics over the whole filtered set.
   *
   * A second aggregate against the same WHERE clause, so the counters
   * describe the entire inbox rather than the page being displayed —
   * "43 unread" is only useful if it means the whole inbox.
   */
  private async summarise(
    actor: ICurrentStaff,
    conditions: SQL[],
  ): Promise<ConversationSummaryDto> {
    const unread = this.unreadExpression(actor.id);
    const where = and(...conditions);

    const [row] = await this.db
      .select({
        totalConversations: count(),
        unreadConversations: sql<number>`count(*) FILTER (WHERE ${unread} > 0)`,
        totalUnreadMessages: sql<number>`COALESCE(SUM(${unread}), 0)`,
        conversationsToday: sql<number>`count(*) FILTER (
          WHERE ${conversations.lastMessageAt}::date = CURRENT_DATE
        )`,
        awaitingReply: sql<number>`count(*) FILTER (
          WHERE ${conversations.lastCustomerMessageAt} IS NOT NULL
            AND (${conversations.lastStaffMessageAt} IS NULL
                 OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt})
        )`,
        vipConversations: sql<number>`count(*) FILTER (WHERE ${isVipSql})`,
        newCustomerConversations: sql<number>`count(*) FILTER (WHERE ${isNewSql})`,
        responsesToday: sql<number>`(
          SELECT COUNT(*) FROM ${messages} m
          WHERE m.conversation_id IN (
            SELECT ${conversations.id} FROM ${conversations}
            INNER JOIN ${customers} ON ${conversations.customerId} = ${customers.id}
            WHERE ${where}
          )
            AND m.sender_type = 'staff'
            AND m.created_at::date = CURRENT_DATE
        )`,
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(where);

    return {
      totalConversations: Number(row?.totalConversations ?? 0),
      unreadConversations: Number(row?.unreadConversations ?? 0),
      totalUnreadMessages: Number(row?.totalUnreadMessages ?? 0),
      responsesToday: Number(row?.responsesToday ?? 0),
      conversationsToday: Number(row?.conversationsToday ?? 0),
      awaitingReply: Number(row?.awaitingReply ?? 0),
      vipConversations: Number(row?.vipConversations ?? 0),
      newCustomerConversations: Number(row?.newCustomerConversations ?? 0),
    };
  }

  /**
   * Thread messages, newest first, cursor-paginated.
   *
   * Cursor rather than offset because a thread grows at the end being
   * read: with OFFSET, a message arriving mid-scroll shifts every
   * subsequent page and the reader sees duplicates.
   */
  async findMessages(
    actor: ICurrentStaff,
    conversationId: string,
    query: MessageThreadQueryDto,
  ): Promise<{
    data: MessageResponseDto[];
    nextCursor: string | null;
    customerReadAt: Date | null;
  }> {
    const conversation = await this.requireScopedConversation(actor, conversationId);

    const conditions: SQL[] = [
      eq(messages.conversationId, conversation.id),
      isNull(messages.deletedAt),
    ];

    if (query.before) {
      // Anchor on the cursor message's timestamp rather than its id, since
      // uuids carry no ordering.
      conditions.push(
        sql`${messages.createdAt} < (SELECT created_at FROM ${messages} WHERE id = ${query.before}::uuid)`,
      );
    }

    const limit = query.limit ?? 50;

    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        senderStaffId: messages.senderStaffId,
        senderStaffUsername: staffUsers.username,
        body: messages.body,
        attachments: messages.attachments,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(staffUsers, eq(messages.senderStaffId, staffUsers.id))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    // Opening a thread marks it read for this viewer only.
    await this.markRead(actor, conversation.id, {});

    return {
      data: data as MessageResponseDto[],
      nextCursor: hasMore ? data[data.length - 1].id : null,
      customerReadAt: conversation.customerLastReadAt ?? null,
    };
  }

  /** Staff reply. Creates the thread if this is the first contact. */
  async sendAsStaff(
    actor: ICurrentStaff,
    customerId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    await this.scopeService.assertCanAccessCustomer(actor, customerId);
    const conversation = await this.ensureConversation(customerId, actor.id);

    if (conversation.status === ConversationStatus.ARCHIVED) {
      throw new BusinessException(
        ErrorCode.CONVERSATION_CLOSED,
        'This conversation is archived and cannot receive new messages',
      );
    }

    return this.appendMessage(conversation, {
      senderType: MessageSenderType.STAFF,
      senderStaffId: actor.id,
      body: dto.body,
      attachments: dto.attachments,
      staffUsername: actor.username,
    });
  }

  /** Customer message. Their thread is created on first send. */
  async sendAsCustomer(customerId: string, dto: SendMessageDto): Promise<MessageResponseDto> {
    const conversation = await this.ensureConversation(customerId, null);

    return this.appendMessage(conversation, {
      senderType: MessageSenderType.CUSTOMER,
      senderCustomerId: customerId,
      body: dto.body,
      attachments: dto.attachments,
    });
  }

  /**
   * Records that this viewer has read up to a point.
   *
   * Upserted per staff member, so marking read never affects what anyone
   * else sees as unread.
   */
  async markRead(
    actor: ICurrentStaff,
    conversationId: string,
    dto: MarkReadDto,
  ): Promise<{ conversationId: string; unreadCount: number }> {
    await this.db
      .insert(conversationReadStates)
      .values({
        conversationId,
        staffId: actor.id,
        lastReadMessageId: dto.lastReadMessageId ?? null,
        lastReadAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [conversationReadStates.conversationId, conversationReadStates.staffId],
        set: {
          lastReadMessageId: dto.lastReadMessageId ?? null,
          lastReadAt: new Date(),
        },
      });

    const [conversation] = await this.db
      .select({ customerId: conversations.customerId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conversation) {
      const { managerId, storeId } = await this.recipientsFor(conversation.customerId);
      this.events.emit(
        CONVERSATION_READ,
        new ConversationReadEvent(
          conversationId,
          conversation.customerId,
          managerId,
          storeId,
          'staff',
          new Date(),
        ),
      );
    }

    return { conversationId, unreadCount: 0 };
  }

  /**
   * The customer has the thread open: everything up to now counts as read
   * for them, and the team's read ticks follow.
   */
  /**
   * Marks a conversation unread again for this viewer only, so they can
   * come back to it: their read position moves to just before the
   * player's latest message.
   */
  async markUnread(actor: ICurrentStaff, conversationId: string): Promise<void> {
    const scope = await this.scopeService.customerScope(actor);
    const [conversation] = await this.db
      .select({ lastCustomerMessageAt: conversations.lastCustomerMessageAt })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(and(eq(conversations.id, conversationId), isNull(customers.deletedAt), scope))
      .limit(1);
    if (!conversation) {
      throw new ResourceNotFoundException(ErrorCode.NOT_FOUND, 'Conversation not found');
    }
    if (!conversation.lastCustomerMessageAt) return;

    const before = new Date(conversation.lastCustomerMessageAt.getTime() - 1);
    await this.db
      .insert(conversationReadStates)
      .values({ conversationId, staffId: actor.id, lastReadAt: before, lastReadMessageId: null })
      .onConflictDoUpdate({
        target: [conversationReadStates.conversationId, conversationReadStates.staffId],
        set: { lastReadAt: before, lastReadMessageId: null },
      });
  }

  async markReadByCustomer(customerId: string): Promise<{ readAt: Date | null }> {
    const conversation = await this.findConversationByCustomer(customerId);
    if (!conversation) return { readAt: null };

    const readAt = new Date();
    await this.db
      .update(conversations)
      .set({ customerLastReadAt: readAt })
      .where(eq(conversations.id, conversation.id));

    const { managerId, storeId } = await this.recipientsFor(customerId);
    this.events.emit(
      CONVERSATION_READ,
      new ConversationReadEvent(
        conversation.id,
        customerId,
        managerId,
        storeId,
        'customer',
        readAt,
      ),
    );
    return { readAt };
  }

  /** The customer's own thread. */
  async customerThread(
    customerId: string,
    query: MessageThreadQueryDto,
  ): Promise<{ data: MessageResponseDto[]; nextCursor: string | null; teamReadAt: Date | null }> {
    const conversation = await this.findConversationByCustomer(customerId);
    if (!conversation) return { data: [], nextCursor: null, teamReadAt: null };

    // The furthest any staff member has read: for the customer, the team
    // has seen a message once anyone on it has.
    const [teamRead] = await this.db
      .select({ readAt: sql<Date | null>`MAX(${conversationReadStates.lastReadAt})` })
      .from(conversationReadStates)
      .where(eq(conversationReadStates.conversationId, conversation.id));

    const conditions: SQL[] = [
      eq(messages.conversationId, conversation.id),
      isNull(messages.deletedAt),
    ];

    if (query.before) {
      conditions.push(
        sql`${messages.createdAt} < (SELECT created_at FROM ${messages} WHERE id = ${query.before}::uuid)`,
      );
    }

    const limit = query.limit ?? 50;

    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        body: messages.body,
        attachments: messages.attachments,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    // Internal staff attribution is deliberately absent from this
    // projection: the customer sees "the business" replied, not which
    // store. The data is still stored, so the choice can be revisited
    // without a migration.
    return {
      data: data as MessageResponseDto[],
      nextCursor: hasMore ? data[data.length - 1].id : null,
      teamReadAt: teamRead?.readAt ? new Date(teamRead.readAt) : null,
    };
  }

  /** Staff messages the customer has not seen since they last read or wrote. */
  async customerUnreadCount(customerId: string): Promise<UnreadCountDto> {
    const conversation = await this.findConversationByCustomer(customerId);
    if (!conversation) return { unreadCount: 0 };

    const [row] = await this.db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          eq(messages.senderType, MessageSenderType.STAFF),
          isNull(messages.deletedAt),
          (() => {
            const seen = [conversation.lastCustomerMessageAt, conversation.customerLastReadAt]
              .filter((value): value is Date => value !== null)
              .sort((a, b) => b.getTime() - a.getTime())[0];
            return seen ? sql`${messages.createdAt} > ${seen}` : sql`true`;
          })(),
        ),
      );

    return { unreadCount: Number(row?.value ?? 0) };
  }

  // ── Internals ───────────────────────────────────────────────

  /**
   * Writes the message and updates the thread's denormalised fields in one
   * transaction, so the inbox can never show a preview that disagrees with
   * the thread.
   */
  private async appendMessage(
    conversation: Conversation,
    input: {
      senderType: MessageSenderType;
      senderStaffId?: string;
      senderCustomerId?: string;
      body: string;
      attachments?: MessageAttachmentDto[];
      staffUsername?: string;
    },
  ): Promise<MessageResponseDto> {
    if (!input.body.trim() && !input.attachments?.length) {
      throw new ValidationException([
        { field: 'body', constraint: 'isNotEmpty', message: 'Write something or attach a file' },
      ]);
    }

    const now = new Date();
    // A message with no text still needs something for the inbox preview.
    const preview = input.body.trim()
      ? input.body.slice(0, 200)
      : `📎 ${input.attachments!.length} attachment${input.attachments!.length === 1 ? '' : 's'}`;

    const created = await this.db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderType: input.senderType,
          senderStaffId: input.senderStaffId,
          senderCustomerId: input.senderCustomerId,
          body: input.body,
          attachments: input.attachments ?? null,
          deliveredAt: now,
        })
        .returning();

      await tx
        .update(conversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: preview,
          messageCount: sql`${conversations.messageCount} + 1`,
          ...(input.senderType === MessageSenderType.CUSTOMER
            ? { lastCustomerMessageAt: now }
            : { lastStaffMessageAt: now }),
          // A message reopens a closed thread: the conversation is
          // evidently still live.
          ...(conversation.status === ConversationStatus.CLOSED
            ? { status: ConversationStatus.OPEN }
            : {}),
        })
        .where(eq(conversations.id, conversation.id));

      return message;
    });

    const response: MessageResponseDto = {
      id: created.id,
      conversationId: created.conversationId,
      senderType: created.senderType,
      senderStaffId: created.senderStaffId,
      senderStaffUsername: input.staffUsername ?? null,
      body: created.body,
      attachments: created.attachments as MessageAttachmentDto[] | null,
      createdAt: created.createdAt,
    };

    // Emitted after commit so a socket listener never broadcasts a message
    // that later rolls back.
    const [owner] = await this.db
      .select({ managerId: customers.managerId, storeId: customers.storeId })
      .from(customers)
      .where(eq(customers.id, conversation.customerId))
      .limit(1);

    this.events.emit(
      MESSAGE_CREATED,
      new MessageCreatedEvent(
        response,
        conversation.id,
        conversation.customerId,
        owner?.managerId ?? null,
        owner?.storeId ?? null,
      ),
    );

    return response;
  }

  /** Finds or creates the customer's single thread. */
  private async ensureConversation(
    customerId: string,
    assignedStaffId: string | null,
  ): Promise<Conversation> {
    const existing = await this.findConversationByCustomer(customerId);
    if (existing) return existing;

    const [created] = await this.db
      .insert(conversations)
      .values({ customerId, assignedStaffId })
      .onConflictDoNothing({ target: conversations.customerId })
      .returning();

    // A concurrent first message may have won the insert; re-read rather
    // than failing.
    return created ?? ((await this.findConversationByCustomer(customerId)) as Conversation);
  }

  private async findConversationByCustomer(customerId: string): Promise<Conversation | undefined> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.customerId, customerId))
      .limit(1);
    return row;
  }

  private async requireScopedConversation(
    actor: ICurrentStaff,
    conversationId: string,
  ): Promise<Conversation> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundException(
        ErrorCode.CONVERSATION_NOT_FOUND,
        'Conversation not found',
      );
    }

    // Access follows the customer, and a denial is reported as not-found
    // so the API never confirms another chain's conversation exists.
    await this.scopeService.assertCanAccessCustomer(actor, row.customerId).catch(() => {
      throw new ResourceNotFoundException(
        ErrorCode.CONVERSATION_NOT_FOUND,
        'Conversation not found',
      );
    });

    return row;
  }

  /**
   * Last sign-in times, used as "last seen" for anyone the gateway has not
   * watched disconnect since it started.
   */
  async lastSignIns(
    customerIds: string[],
    staffIds: string[],
  ): Promise<{ customers: Map<string, Date>; staff: Map<string, Date> }> {
    const [customerRows, staffRows] = await Promise.all([
      customerIds.length
        ? this.db
            .select({ id: customers.id, at: customers.lastLoginAt })
            .from(customers)
            .where(inArray(customers.id, customerIds))
        : Promise.resolve([]),
      staffIds.length
        ? this.db
            .select({ id: staffUsers.id, at: staffUsers.lastLoginAt })
            .from(staffUsers)
            .where(inArray(staffUsers.id, staffIds))
        : Promise.resolve([]),
    ]);
    const toMap = (rows: { id: string; at: Date | null }[]) =>
      new Map(rows.filter((row) => row.at).map((row) => [row.id, row.at as Date]));
    return { customers: toMap(customerRows), staff: toMap(staffRows) };
  }

  /** Staff who should receive a live update for a conversation. */
  async recipientsFor(
    customerId: string,
  ): Promise<{ managerId: string | null; storeId: string | null }> {
    const [row] = await this.db
      .select({ managerId: customers.managerId, storeId: customers.storeId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return { managerId: row?.managerId ?? null, storeId: row?.storeId ?? null };
  }
}
