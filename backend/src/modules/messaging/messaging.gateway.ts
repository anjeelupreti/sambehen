import { Logger } from '@nestjs/common';
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
import { MessagingService, MESSAGE_CREATED, MessageCreatedEvent } from './messaging.service';
import { STAFF_MESSAGE_CREATED, StaffMessageCreatedEvent } from './staff-messaging.service';

/** Identity attached to a socket once its handshake token is verified. */
interface ISocketPrincipal {
  realm: AuthRealm;
  id: string;
  role?: StaffRole;
  parentId?: string | null;
}

type AuthedSocket = Socket & { principal?: ISocketPrincipal };

/** Room naming. Kept in one place so publisher and subscriber cannot drift. */
const room = {
  staff: (staffId: string): string => `staff:${staffId}`,
  customer: (customerId: string): string => `customer:${customerId}`,
  masters: (): string => 'role:master',
};

/**
 * Real-time messaging.
 *
 * Both realms connect to the same namespace but are authenticated against
 * their own secret, exactly as the HTTP guards do — a customer token
 * cannot open a staff socket.
 *
 * Fan-out is by identity room, not by conversation. Joining every
 * conversation a master can see would mean thousands of rooms per socket;
 * instead each message resolves its owning runner and manager and emits to
 * at most four rooms. Work per message is constant regardless of how many
 * customers the chain holds.
 *
 * Single-instance: the default in-memory adapter is correct here. Running
 * two instances needs @socket.io/redis-adapter, which is a one-line change
 * and nothing else.
 */
@WebSocketGateway({
  namespace: '/ws/messaging',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
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
    } else {
      await client.join(room.staff(principal.id));
      // Masters see everything, so they subscribe to a single broadcast
      // room rather than one room per customer in the business.
      if (principal.role === StaffRole.MASTER) {
        await client.join(room.masters());
      }
    }

    client.emit('connected', { realm: principal.realm, id: principal.id });
  }

  handleDisconnect(client: AuthedSocket): void {
    if (client.principal) {
      this.logger.debug(`Socket ${client.id} (${client.principal.realm}) disconnected`);
    }
  }

  /**
   * Fans a new message out to everyone entitled to see it.
   *
   * Listens to the same domain event the REST path emits, so a message
   * sent over HTTP reaches sockets identically to one sent over the
   * socket. There is no second delivery path to keep in step.
   */
  @OnEvent(MESSAGE_CREATED)
  handleMessageCreated(event: MessageCreatedEvent): void {
    // The customer never receives internal staff attribution.
    const { senderStaffId, senderStaffUsername, ...customerView } = event.message;
    void senderStaffId;
    void senderStaffUsername;

    this.server.to(room.customer(event.customerId)).emit('message:new', customerView);

    const staffRooms = [room.masters()];
    if (event.runnerId) staffRooms.push(room.staff(event.runnerId));
    if (event.managerId) staffRooms.push(room.staff(event.managerId));

    this.server.to(staffRooms).emit('message:new', {
      ...event.message,
      conversationId: event.conversationId,
      customerId: event.customerId,
    });
  }

  /**
   * Fans an internal staff message out to both participants.
   *
   * Unlike the customer path there is no masters-room broadcast: an
   * internal DM is between exactly two people, and a master not in the
   * thread has no more standing to see it live than anyone else who isn't
   * in it — the same as REST, where `findMessages` 404s for a non-
   * participant rather than scoping by role.
   */
  @OnEvent(STAFF_MESSAGE_CREATED)
  handleStaffMessageCreated(event: StaffMessageCreatedEvent): void {
    const rooms = event.participantIds.map((id) => room.staff(id));
    this.server.to(rooms).emit('staffmessage:new', event.message);
  }

  /** Typing indicator, relayed rather than stored. */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { customerId?: string; isTyping: boolean },
  ): Promise<void> {
    const principal = client.principal;
    if (!principal) return;

    if (principal.realm === AuthRealm.CUSTOMER) {
      const { managerId, runnerId } = await this.messagingService.recipientsFor(principal.id);
      const rooms = [room.masters()];
      if (runnerId) rooms.push(room.staff(runnerId));
      if (managerId) rooms.push(room.staff(managerId));

      this.server.to(rooms).emit('typing', {
        customerId: principal.id,
        isTyping: payload.isTyping,
      });
      return;
    }

    // Staff typing is shown to the customer without naming who.
    if (payload.customerId) {
      this.server.to(room.customer(payload.customerId)).emit('typing', {
        isTyping: payload.isTyping,
      });
    }
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
