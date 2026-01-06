import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/mobile',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private userSocketMap = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private socketUserMap = new Map<string, string>(); // socketId -> userId

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized on /mobile namespace');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (socket: ${client.id})`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || !payload.sub) {
        this.logger.warn(`Connection rejected: Invalid token (socket: ${client.id})`);
        client.disconnect();
        return;
      }

      const userId = payload.sub;

      // Store user-socket mapping
      client.userId = userId;
      this.socketUserMap.set(client.id, userId);

      if (!this.userSocketMap.has(userId)) {
        this.userSocketMap.set(userId, new Set());
      }
      this.userSocketMap.get(userId)!.add(client.id);

      // Auto-join user's personal room
      await client.join(`user:${userId}`);

      this.logger.log(`User ${userId} connected (socket: ${client.id})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId) {
      const userSockets = this.userSocketMap.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSocketMap.delete(userId);
        }
      }
      this.socketUserMap.delete(client.id);
      this.logger.log(`User ${userId} disconnected (socket: ${client.id})`);
    }
  }

  /**
   * Subscribe to property price updates
   */
  @SubscribeMessage('subscribe:property')
  async handleSubscribeProperty(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string },
  ) {
    if (!client.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!data?.propertyId) {
      return { error: 'propertyId is required' };
    }

    const room = `property:${data.propertyId}`;
    await client.join(room);
    this.logger.log(
      `User ${client.userId} subscribed to property ${data.propertyId}`,
    );

    return { success: true, propertyId: data.propertyId };
  }

  /**
   * Unsubscribe from property price updates
   */
  @SubscribeMessage('unsubscribe:property')
  async handleUnsubscribeProperty(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string },
  ) {
    if (!client.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!data?.propertyId) {
      return { error: 'propertyId is required' };
    }

    const room = `property:${data.propertyId}`;
    await client.leave(room);
    this.logger.log(
      `User ${client.userId} unsubscribed from property ${data.propertyId}`,
    );

    return { success: true, propertyId: data.propertyId };
  }

  /**
   * Subscribe to portfolio updates (when user is on portfolio page)
   */
  @SubscribeMessage('subscribe:portfolio')
  async handleSubscribePortfolio(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const room = `portfolio:${client.userId}`;
    await client.join(room);
    this.logger.log(
      `User ${client.userId} subscribed to portfolio updates`,
    );

    return { success: true, userId: client.userId };
  }

  /**
   * Unsubscribe from portfolio updates (when user leaves portfolio page)
   */
  @SubscribeMessage('unsubscribe:portfolio')
  async handleUnsubscribePortfolio(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const room = `portfolio:${client.userId}`;
    await client.leave(room);
    this.logger.log(
      `User ${client.userId} unsubscribed from portfolio updates`,
    );

    return { success: true, userId: client.userId };
  }

  /**
   * Listen to candle update event from scheduled aggregation task
   * Broadcasts aggregated candle data (updated every 15 minutes)
   */
  @OnEvent('candle.updated')
  handleCandleUpdated(payload: {
    propertyId: string;
    candle: {
      date: Date;
      openPrice: number;
      highPrice: number;
      lowPrice: number;
      closePrice: number;
      volume: number;
      tradeCount: number;
    };
    timestamp: Date;
  }) {
    const room = `property:${payload.propertyId}`;

    // Broadcast candle update to all clients subscribed to this property
    this.server.to(room).emit('candle:updated', {
      propertyId: payload.propertyId,
      candle: payload.candle,
      timestamp: payload.timestamp,
    });

    this.logger.debug(
      `Broadcasted candle update for property ${payload.propertyId} to room ${room}`,
    );
  }

  /**
   * Listen to portfolio candle update event from scheduled aggregation task
   * Broadcasts aggregated portfolio candle data (updated every 5 minutes)
   * Only sends to users who are subscribed to portfolio updates (on portfolio page)
   */
  @OnEvent('portfolio.candle.updated')
  handlePortfolioCandleUpdated(payload: {
    userId: string;
    candle: {
      date: Date;
      openValue: number;
      highValue: number;
      lowValue: number;
      closeValue: number;
      totalInvested: number;
      snapshotCount: number;
    };
    timestamp: Date;
  }) {
    const room = `portfolio:${payload.userId}`;

    // Broadcast portfolio candle update to user's portfolio room
    // Only users who subscribed (are on portfolio page) will receive this
    this.server.to(room).emit('portfolio:candle:updated', {
      userId: payload.userId,
      candle: payload.candle,
      timestamp: payload.timestamp,
    });

    this.logger.debug(
      `Broadcasted portfolio candle update for user ${payload.userId} to room ${room}`,
    );
  }
}
