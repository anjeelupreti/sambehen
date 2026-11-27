import { Logger } from '@nestjs/common';
import {
  NOTIFICATION_CREATED,
  NotificationCreatedEvent,
  WIN_RECORDED,
  WinRecordedEvent,
} from '@common/events/domain-events';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthRealm, StaffRole } from '@common/constants/app.constants';
import { ITeamJwtPayload, ICustomerJwtPayload } from '@common/interfaces/auth.interface';
import {
  MessagingService,
  MESSAGE_CREATED,
  MessageCreatedEvent,
  CONVERSATION_READ,
  ConversationReadEvent,
} from './messaging.service';
import {
  StaffMessagingService,
  STAFF_MESSAGE_CREATED,
  StaffMessageCreatedEvent,
  STAFF_CONVERSATION_READ,
  StaffConversationReadEvent,
} from './staff-messaging.service';

/** Identity attached to a socket once its handshake token is verified. */
interface ISocketPrincipal {
  realm: AuthRealm;
  id: string;
  role?: StaffRole;
  parentId?: string | null;
}

type AuthedSocket = Socket & { principal?: ISocketPrincipal };

/** One person's presence, as clients receive it. */
interface IPresence {
  online: boolean;
  lastSeenAt: string | null;
}

/** Room naming. Kept in one place so publisher and subscriber cannot drift. */
const room = {
  staff: (staffId: string): string => `staff:${staffId}`,
  customer: (customerId: string): string => `customer:${customerId}`,
  masters: (): string => 'role:master',
  customers: (): string => 'role:customer',
};

const presenceKey = {
  staff: (id: string) => `staff:${id}`,
  customer: (id: string) => `customer:${id}`,
};

/** A presence query never asks about more people than an inbox shows. */
const MAX_PRESENCE_QUERY = 200;

/**
 * Real-time messaging: delivery, typing, read receipts and presence.
 *
 * Both realms connect to the same namespace but are authenticated against
 * their own secret, exactly as the HTTP guards do — a customer token
 * cannot open a staff socket.
 *
 * Fan-out is by identity room, not by conversation. Joining every
 * conversation a master can see would mean thousands of rooms per socket;
 * instead each event resolves its owning store and manager and emits to at
 * most four rooms.
 *
 * Presence follows the same visibility as messages. A customer's online
 * state reaches only the staff who can see their thread; a staff member's
 * reaches only the colleagues they may message; a customer sees one fact
 * about staff — whether anyone on their team is online — never who.
 *
 * Single-instance: connection counts live in memory, which is correct
 * with the default adapter. Running two instances needs
 * @socket.io/redis-adapter and moving these counts to Redis.
 */
@WebSocketGateway({
  namespace: '/ws/messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  private server!: Server;

  /** Open sockets per person; a person with two tabs is online until both close. */
  private readonly connections = new Map<string, number>();
  /** When each person's last socket closed, since this process started. */
  private readonly lastSeen = new Map<string, Date>();
  /** Masters currently online; any of them counts as a customer's team. */
  private readonly mastersOnline = new Set<string>();
  /** Connected customers and their chain, to recompute "team online". */
  private readonly connectedCustomers = new Map<
    string,
    { storeId: string | null; managerId: string | null; teamOnline: boolean }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
    private readonly staffMessagingService: StaffMessagingService,
  ) {}

  /**
   * Authenticates the handshake and joins the socket's identity rooms.
   *
   * An unauthenticated socket is disconnected rather than left idle: a
   * connection that cannot be attributed has no legitimate use here.
   */
  async handleConnection(client: AuthedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(`Socket ${client.id} connected without a token; disconnecting`);
      client.emit('auth:error', { code: 'AUTH_TOKEN_MISSING' });
      client.disconnect(true);
      return;
    }

    const principal = await this.verify(token);
    if (!principal) {
      client.emit('auth:error', { code: 'AUTH_TOKEN_INVALID' });
      client.disconnect(true);
      return;
    }

    client.principal = principal;

    if (principal.realm === AuthRealm.CUSTOMER) {
      await client.join(room.customer(principal.id));
      await client.join(room.customers());
    } else {
      await client.join(room.staff(principal.id));
      // Masters see everything, so they subscribe to a single broadcast
      // room rather than one room per customer in the business.
      if (principal.role === StaffRole.MASTER) {
        await client.join(room.masters());
      }
    }

    client.emit('connected', { realm: principal.realm, id: principal.id });
    await this.trackConnect(principal, client);
  }

  async handleDisconnect(client: AuthedSocket): Promise<void> {
    if (!client.principal) return;
    this.logger.debug(`Socket ${client.id} (${client.principal.realm}) disconnected`);
    await this.trackDisconnect(client.principal);
  }

  // ── Delivery ────────────────────────────────────────────────

  @OnEvent(MESSAGE_CREATED)
  handleMessageCreated(event: MessageCreatedEvent): void {
    // The customer never receives internal staff attribution.
    const { senderStaffId, senderStaffUsername, ...customerView } = event.message;
    void senderStaffId;
    void senderStaffUsername;

    this.server.to(room.customer(event.customerId)).emit('message:new', customerView);

    this.server.to(this.staffRoomsFor(event.storeId, event.managerId)).emit('message:new', {
      ...event.message,
      conversationId: event.conversationId,
      customerId: event.customerId,
    });
  }

  @OnEvent(STAFF_MESSAGE_CREATED)
  handleStaffMessageCreated(event: StaffMessageCreatedEvent): void {
    const rooms = event.participantIds.map((id) => room.staff(id));
    this.server.to(rooms).emit('staffmessage:new', event.message);
  }

  // ── Read receipts ───────────────────────────────────────────

  @OnEvent(WIN_RECORDED)
  handleWin(event: WinRecordedEvent): void {
    this.server.to(room.customers()).emit('win:new', event.win);
  }

  @OnEvent(NOTIFICATION_CREATED)
  handleNotification(event: NotificationCreatedEvent): void {
    const target =
      event.realm === 'team' ? room.staff(event.recipientId) : room.customer(event.recipientId);
    this.server.to(target).emit('notification:new', event.notification);
  }

  @OnEvent(CONVERSATION_READ)
  handleConversationRead(event: ConversationReadEvent): void {
    const readAt = event.readAt.toISOString();
    if (event.by === 'customer') {
      this.server.to(this.staffRoomsFor(event.storeId, event.managerId)).emit('conversation:read', {
        conversationId: event.conversationId,
        customerId: event.customerId,
        by: 'customer',
        readAt,
      });
    } else {
      // The customer learns the team has read, never which staff member.
      this.server
        .to(room.customer(event.customerId))
        .emit('conversation:read', { by: 'team', readAt });
    }
  }

  @OnEvent(STAFF_CONVERSATION_READ)
  handleStaffConversationRead(event: StaffConversationReadEvent): void {
    const other = event.participantIds.find((id) => id !== event.readerId);
    if (!other) return;
    this.server.to(room.staff(other)).emit('staffconversation:read', {
      conversationId: event.conversationId,
      readerId: event.readerId,
      readAt: event.readAt.toISOString(),
    });
  }

  // ── Typing ──────────────────────────────────────────────────

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { customerId?: string; isTyping: boolean },
  ): Promise<void> {
    const principal = client.principal;
    if (!principal) return;
    const isTyping = Boolean(payload?.isTyping);

    if (principal.realm === AuthRealm.CUSTOMER) {
      const { managerId, storeId } = await this.messagingService.recipientsFor(principal.id);
      this.server
        .to(this.staffRoomsFor(storeId, managerId))
        .emit('typing', { customerId: principal.id, isTyping });
      return;
    }

    // Staff typing reaches only a customer in their own chain, and the
    // customer is not told who.
    if (payload?.customerId && (await this.staffCanSeeCustomer(principal, payload.customerId))) {
      this.server.to(room.customer(payload.customerId)).emit('typing', { isTyping });
    }
  }

  @SubscribeMessage('staff:typing')
  async handleStaffTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId?: string; isTyping: boolean },
  ): Promise<void> {
    const principal = client.principal;
    if (!principal || principal.realm !== AuthRealm.TEAM || !payload?.conversationId) return;

    const participants = await this.staffMessagingService.participantsOf(payload.conversationId);
    if (!participants?.includes(principal.id)) return;

    const other = participants.find((id) => id !== principal.id);
    if (!other) return;
    this.server.to(room.staff(other)).emit('staff:typing', {
      conversationId: payload.conversationId,
      staffId: principal.id,
      isTyping: Boolean(payload.isTyping),
    });
  }

  // ── Presence ────────────────────────────────────────────────

  /**
   * Presence for the people a client is about to show, answered only for
   * those it may see. A customer gets one answer: whether their team is
   * online.
   */
  @SubscribeMessage('presence:query')
  async handlePresenceQuery(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { customerIds?: string[]; staffIds?: string[] },
  ): Promise<{
    customers: Record<string, IPresence>;
    staff: Record<string, IPresence>;
    team?: { online: boolean };
  }> {
    const principal = client.principal;
    if (!principal) return { customers: {}, staff: {} };

    if (principal.realm === AuthRealm.CUSTOMER) {
      const chain = this.connectedCustomers.get(principal.id);
      return { customers: {}, staff: {}, team: { online: chain?.teamOnline ?? false } };
    }

    const requestedCustomers = [...new Set(payload?.customerIds ?? [])].slice(
      0,
      MAX_PRESENCE_QUERY,
    );
    const requestedStaff = [...new Set(payload?.staffIds ?? [])].slice(0, MAX_PRESENCE_QUERY);

    const visibleCustomers = (
      await Promise.all(
        requestedCustomers.map(async (id) =>
          (await this.staffCanSeeCustomer(principal, id)) ? id : null,
        ),
      )
    ).filter((id): id is string => id !== null);

    const contacts = new Set(
      requestedStaff.length
        ? await this.staffMessagingService.contactIds(this.asActor(principal))
        : [],
    );
    const visibleStaff = requestedStaff.filter((id) => contacts.has(id));

    const fallback = await this.messagingService.lastSignIns(
      visibleCustomers.filter((id) => !this.lastSeen.has(presenceKey.customer(id))),
      visibleStaff.filter((id) => !this.lastSeen.has(presenceKey.staff(id))),
    );

    const customers: Record<string, IPresence> = {};
    for (const id of visibleCustomers) {
      customers[id] = this.presenceOf(presenceKey.customer(id), fallback.customers.get(id));
    }
    const staff: Record<string, IPresence> = {};
    for (const id of visibleStaff) {
      staff[id] = this.presenceOf(presenceKey.staff(id), fallback.staff.get(id));
    }
    return { customers, staff };
  }

  private presenceOf(key: string, fallback?: Date): IPresence {
    const online = (this.connections.get(key) ?? 0) > 0;
    const seen = this.lastSeen.get(key) ?? fallback ?? null;
    return { online, lastSeenAt: online || !seen ? null : seen.toISOString() };
  }

  private async trackConnect(principal: ISocketPrincipal, client: AuthedSocket): Promise<void> {
    const key = this.keyOf(principal);
    const count = (this.connections.get(key) ?? 0) + 1;
    this.connections.set(key, count);

    if (principal.realm === AuthRealm.CUSTOMER) {
      const { storeId, managerId } = await this.messagingService.recipientsFor(principal.id);
      const teamOnline = this.isTeamOnline(storeId, managerId);
      this.connectedCustomers.set(principal.id, { storeId, managerId, teamOnline });
      client.emit('team:presence', { online: teamOnline });
      if (count === 1) {
        this.server
          .to(this.staffRoomsFor(storeId, managerId))
          .emit('presence', { kind: 'customer', id: principal.id, online: true, lastSeenAt: null });
      }
      return;
    }

    if (principal.role === StaffRole.MASTER) this.mastersOnline.add(principal.id);
    if (count === 1) await this.broadcastStaffPresence(principal, true);
  }

  private async trackDisconnect(principal: ISocketPrincipal): Promise<void> {
    const key = this.keyOf(principal);
    const count = Math.max((this.connections.get(key) ?? 1) - 1, 0);
    if (count > 0) {
      this.connections.set(key, count);
      return;
    }

    this.connections.delete(key);
    const now = new Date();
    this.lastSeen.set(key, now);

    if (principal.realm === AuthRealm.CUSTOMER) {
      const chain = this.connectedCustomers.get(principal.id);
      this.connectedCustomers.delete(principal.id);
      this.server
        .to(this.staffRoomsFor(chain?.storeId ?? null, chain?.managerId ?? null))
        .emit('presence', {
          kind: 'customer',
          id: principal.id,
          online: false,
          lastSeenAt: now.toISOString(),
        });
      return;
    }

    if (principal.role === StaffRole.MASTER) this.mastersOnline.delete(principal.id);
    await this.broadcastStaffPresence(principal, false, now);
  }

  /**
   * Tells a staff member's contacts they came or went, then re-evaluates
   * "team online" for every connected customer they could affect.
   */
  private async broadcastStaffPresence(
    principal: ISocketPrincipal,
    online: boolean,
    seenAt?: Date,
  ): Promise<void> {
    const contacts = await this.staffMessagingService.contactIds(this.asActor(principal));
    if (contacts.length > 0) {
      this.server.to(contacts.map((id) => room.staff(id))).emit('presence', {
        kind: 'staff',
        id: principal.id,
        online,
        lastSeenAt: online ? null : (seenAt ?? new Date()).toISOString(),
      });
    }

    for (const [customerId, chain] of this.connectedCustomers) {
      const affected =
        principal.role === StaffRole.MASTER ||
        chain.storeId === principal.id ||
        chain.managerId === principal.id;
      if (!affected) continue;

      const teamOnline = this.isTeamOnline(chain.storeId, chain.managerId);
      if (teamOnline !== chain.teamOnline) {
        chain.teamOnline = teamOnline;
        this.server.to(room.customer(customerId)).emit('team:presence', { online: teamOnline });
      }
    }
  }

  private isTeamOnline(storeId: string | null, managerId: string | null): boolean {
    const isOnline = (id: string | null) =>
      id !== null && (this.connections.get(presenceKey.staff(id)) ?? 0) > 0;
    return this.mastersOnline.size > 0 || isOnline(storeId) || isOnline(managerId);
  }

  // ── Helpers ─────────────────────────────────────────────────

  /** The staff rooms that see a customer's thread: masters, their store, their manager. */
  private staffRoomsFor(storeId: string | null, managerId: string | null): string[] {
    const rooms = [room.masters()];
    if (storeId) rooms.push(room.staff(storeId));
    if (managerId) rooms.push(room.staff(managerId));
    return rooms;
  }

  private async staffCanSeeCustomer(
    principal: ISocketPrincipal,
    customerId: string,
  ): Promise<boolean> {
    if (principal.role === StaffRole.MASTER) return true;
    const { storeId, managerId } = await this.messagingService.recipientsFor(customerId);
    return principal.id === storeId || principal.id === managerId;
  }

  private keyOf(principal: ISocketPrincipal): string {
    return principal.realm === AuthRealm.CUSTOMER
      ? presenceKey.customer(principal.id)
      : presenceKey.staff(principal.id);
  }

  private asActor(principal: ISocketPrincipal) {
    return {
      id: principal.id,
      role: principal.role as StaffRole,
      parentId: principal.parentId ?? null,
    };
  }

  /** Verifies against the secret for whichever realm the token claims. */
  private async verify(token: string): Promise<ISocketPrincipal | null> {
    // Try team first, then customer. The secrets differ, so a token only
    // ever verifies against its own realm.
    try {
      const payload = await this.jwtService.verifyAsync<ITeamJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      });
      if (payload.realm === AuthRealm.TEAM) {
        return {
          realm: AuthRealm.TEAM,
          id: payload.sub,
          role: payload.role,
          parentId: payload.parentId,
        };
      }
    } catch {
      // Not a team token; fall through.
    }

    try {
      const payload = await this.jwtService.verifyAsync<ICustomerJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.customerSecret'),
      });
      if (payload.realm === AuthRealm.CUSTOMER) {
        return { realm: AuthRealm.CUSTOMER, id: payload.sub };
      }
    } catch {
      // Not a customer token either.
    }

    return null;
  }
}
