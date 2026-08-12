import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ErrorCode } from '@common/constants/error-codes';
import {
  ResourceNotFoundException,
  ValidationException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import {
  staffConversations,
  staffMessages,
  staffConversationReadStates,
  StaffConversation,
} from '@database/schema/staff-messaging.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { ScopeService } from '@shared/scope/scope.service';
import {
  SendStaffMessageDto,
  StaffMarkReadDto,
  StaffConversationFilterDto,
  StaffContactFilterDto,
  StaffMessageThreadQueryDto,
  StaffContactDto,
  StaffConversationResponseDto,
  StaffMessageResponseDto,
} from './dto/staff-messaging.dto';

/** Emitted after a staff-to-staff message is committed, for the gateway to fan out. */
export const STAFF_MESSAGE_CREATED = 'staffmessage.created';

export class StaffMessageCreatedEvent {
  constructor(
    readonly message: StaffMessageResponseDto,
    readonly participantIds: [string, string],
  ) {}
}

/**
 * Internal messaging between staff, entirely separate from customer
 * conversations: different tables, different scoping (hierarchy rather
 * than customer ownership), different UI surface. The two share only the
 * transport (REST + the same socket namespace) because there is no reason
 * for them to share more than that.
 *
 * A thread exists per unordered pair of staff, canonically stored with the
 * lexically smaller id first — see the schema comment for why.
 */
@Injectable()
export class StaffMessagingService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly events: EventEmitter2,
  ) {}

  /** Staff the actor may open a DM with, per the hierarchy rule. */
  async contacts(actor: ICurrentStaff, filters: StaffContactFilterDto): Promise<StaffContactDto[]> {
    const conditions: SQL[] = [isNull(staffUsers.deletedAt), eq(staffUsers.isActive, true)];
    conditions.push(this.scopeService.staffMessagingScope(actor));

    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        sql`(${staffUsers.username} ILIKE ${term}
             OR ${staffUsers.firstName} ILIKE ${term}
             OR ${staffUsers.lastName} ILIKE ${term}
             OR ${staffUsers.email} ILIKE ${term})`,
      );
    }

    const rows = await this.db
      .select({
        id: staffUsers.id,
        username: staffUsers.username,
        firstName: staffUsers.firstName,
        lastName: staffUsers.lastName,
        role: staffUsers.role,
      })
      .from(staffUsers)
      .where(and(...conditions))
      .orderBy(staffUsers.role, staffUsers.username)
      .limit(50);

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(' ') || null,
      role: row.role,
    }));
  }

  /**
   * Inbox: every thread the actor holds, newest first, with a per-viewer
   * unread count.
   *
   * Joins `staff_users` twice — once per side of the pair — rather than
   * resolving the counterpart with a second query. That is not just fewer
   * round trips: `unreadExpression`'s correlated subquery references
   * `staffConversations.id`, and Drizzle only qualifies that reference with
   * its table name when the surrounding query already touches more than
   * one table. A single-table `.from(staffConversations)` renders the
   * correlation as a bare `"id"`, which Postgres then resolves against
   * `staff_messages`' own `id` column instead — same name, wrong table —
   * and every unread count silently comes back zero. The join isn't
   * optional decoration; it's what keeps that reference correlated to the
   * right row.
   */
  async findInbox(
    actor: ICurrentStaff,
    filters: StaffConversationFilterDto,
  ): Promise<IPaginatedResult<StaffConversationResponseDto>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));

    const staffA = alias(staffUsers, 'staff_a_user');
    const staffB = alias(staffUsers, 'staff_b_user');

    const where = or(
      eq(staffConversations.staffAId, actor.id),
      eq(staffConversations.staffBId, actor.id),
    )!;

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: staffConversations.id,
          staffAId: staffConversations.staffAId,
          staffBId: staffConversations.staffBId,
          staffAUsername: staffA.username,
          staffAFirstName: staffA.firstName,
          staffALastName: staffA.lastName,
          staffARole: staffA.role,
          staffBUsername: staffB.username,
          staffBFirstName: staffB.firstName,
          staffBLastName: staffB.lastName,
          staffBRole: staffB.role,
          lastMessagePreview: staffConversations.lastMessagePreview,
          lastMessageAt: staffConversations.lastMessageAt,
          messageCount: staffConversations.messageCount,
          unreadCount: this.unreadExpression(actor.id),
        })
        .from(staffConversations)
        .innerJoin(staffA, eq(staffConversations.staffAId, staffA.id))
        .innerJoin(staffB, eq(staffConversations.staffBId, staffB.id))
        .where(where)
        .orderBy(
          desc(sql`COALESCE(${staffConversations.lastMessageAt}, ${staffConversations.createdAt})`),
        )
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: sql<number>`COUNT(*)` })
        .from(staffConversations)
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => {
        const isA = row.staffAId === actor.id;
        return {
          id: row.id,
          counterpartId: isA ? row.staffBId : row.staffAId,
          counterpartUsername: isA ? row.staffBUsername : row.staffAUsername,
          counterpartFullName:
            [
              isA ? row.staffBFirstName : row.staffAFirstName,
              isA ? row.staffBLastName : row.staffALastName,
            ]
              .filter(Boolean)
              .join(' ') || null,
          counterpartRole: isA ? row.staffBRole : row.staffARole,
          lastMessagePreview: row.lastMessagePreview,
          lastMessageAt: row.lastMessageAt,
          messageCount: row.messageCount,
          unreadCount: Number(row.unreadCount),
        };
      }),
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

  async findMessages(
    actor: ICurrentStaff,
    conversationId: string,
    query: StaffMessageThreadQueryDto,
  ): Promise<{ data: StaffMessageResponseDto[]; nextCursor: string | null }> {
    const conversation = await this.requireOwnConversation(actor, conversationId);

    const conditions: SQL[] = [
      eq(staffMessages.conversationId, conversation.id),
      isNull(staffMessages.deletedAt),
    ];

    if (query.before) {
      conditions.push(
        sql`${staffMessages.createdAt} < (SELECT created_at FROM ${staffMessages} WHERE id = ${query.before}::uuid)`,
      );
    }

    const limit = query.limit ?? 50;

    const rows = await this.db
      .select({
        id: staffMessages.id,
        conversationId: staffMessages.conversationId,
        senderStaffId: staffMessages.senderStaffId,
        senderUsername: staffUsers.username,
        body: staffMessages.body,
        attachments: staffMessages.attachments,
        createdAt: staffMessages.createdAt,
      })
      .from(staffMessages)
      .innerJoin(staffUsers, eq(staffMessages.senderStaffId, staffUsers.id))
      .where(and(...conditions))
      .orderBy(desc(staffMessages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    await this.markRead(actor, conversation.id, {});

    return {
      data: data as StaffMessageResponseDto[],
      nextCursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  /** Sends a message, creating the thread on first contact. */
  async send(actor: ICurrentStaff, dto: SendStaffMessageDto): Promise<StaffMessageResponseDto> {
    await this.scopeService.assertCanMessageStaff(actor, dto.targetStaffId);

    if (!dto.body.trim() && !dto.attachments?.length) {
      throw new ValidationException([
        { field: 'body', constraint: 'isNotEmpty', message: 'Write something or attach a file' },
      ]);
    }

    const conversation = await this.ensureConversation(actor.id, dto.targetStaffId);

    const now = new Date();
    const preview = dto.body.trim()
      ? dto.body.slice(0, 200)
      : `📎 ${dto.attachments!.length} attachment${dto.attachments!.length === 1 ? '' : 's'}`;

    const created = await this.db.transaction(async (tx) => {
      const [message] = await tx
        .insert(staffMessages)
        .values({
          conversationId: conversation.id,
          senderStaffId: actor.id,
          body: dto.body,
          attachments: dto.attachments ?? null,
        })
        .returning();

      await tx
        .update(staffConversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: preview,
          messageCount: sql`${staffConversations.messageCount} + 1`,
        })
        .where(eq(staffConversations.id, conversation.id));

      return message;
    });

    const response: StaffMessageResponseDto = {
      id: created.id,
      conversationId: created.conversationId,
      senderStaffId: actor.id,
      senderUsername: actor.username,
      body: created.body,
      attachments: created.attachments as StaffMessageResponseDto['attachments'],
      createdAt: created.createdAt,
    };

    this.events.emit(
      STAFF_MESSAGE_CREATED,
      new StaffMessageCreatedEvent(response, [conversation.staffAId, conversation.staffBId]),
    );

    return response;
  }

  async markRead(
    actor: ICurrentStaff,
    conversationId: string,
    dto: StaffMarkReadDto,
  ): Promise<{ conversationId: string; unreadCount: number }> {
    await this.db
      .insert(staffConversationReadStates)
      .values({
        conversationId,
        staffId: actor.id,
        lastReadMessageId: dto.lastReadMessageId ?? null,
        lastReadAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [staffConversationReadStates.conversationId, staffConversationReadStates.staffId],
        set: {
          lastReadMessageId: dto.lastReadMessageId ?? null,
          lastReadAt: new Date(),
        },
      });

    return { conversationId, unreadCount: 0 };
  }

  // ── Internals ───────────────────────────────────────────────

  private unreadExpression(staffId: string): SQL<number> {
    return sql<number>`(
      SELECT COUNT(*) FROM ${staffMessages} m
      WHERE m.conversation_id = ${staffConversations.id}
        AND m.sender_staff_id != ${staffId}::uuid
        AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(
          (SELECT rs.last_read_at FROM ${staffConversationReadStates} rs
           WHERE rs.conversation_id = ${staffConversations.id}
             AND rs.staff_id = ${staffId}::uuid),
          '-infinity'::timestamptz
        )
    )`;
  }

  /** Finds or creates the thread for this pair, in canonical (sorted) order. */
  private async ensureConversation(staffId: string, otherId: string): Promise<StaffConversation> {
    const [staffAId, staffBId] = [staffId, otherId].sort();

    const existing = await this.findConversationByPair(staffAId, staffBId);
    if (existing) return existing;

    const [created] = await this.db
      .insert(staffConversations)
      .values({ staffAId, staffBId })
      .onConflictDoNothing({ target: [staffConversations.staffAId, staffConversations.staffBId] })
      .returning();

    return (
      created ?? ((await this.findConversationByPair(staffAId, staffBId)) as StaffConversation)
    );
  }

  private async findConversationByPair(
    staffAId: string,
    staffBId: string,
  ): Promise<StaffConversation | undefined> {
    const [row] = await this.db
      .select()
      .from(staffConversations)
      .where(
        and(eq(staffConversations.staffAId, staffAId), eq(staffConversations.staffBId, staffBId)),
      )
      .limit(1);
    return row;
  }

  /** A conversation the actor is not a participant of is reported as not-found. */
  private async requireOwnConversation(
    actor: ICurrentStaff,
    conversationId: string,
  ): Promise<StaffConversation> {
    const [row] = await this.db
      .select()
      .from(staffConversations)
      .where(eq(staffConversations.id, conversationId))
      .limit(1);

    if (!row || (row.staffAId !== actor.id && row.staffBId !== actor.id)) {
      throw new ResourceNotFoundException(
        ErrorCode.CONVERSATION_NOT_FOUND,
        'Conversation not found',
      );
    }

    return row;
  }
}
