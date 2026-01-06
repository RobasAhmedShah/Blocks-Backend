# WebSocket Real-time Updates

## Overview

This WebSocket gateway provides real-time updates for the Blocks marketplace. Updates are sent via aggregated candle data (updated periodically) rather than individual price events.

## Features

- ✅ JWT authentication for secure connections
- ✅ Property-specific room subscriptions
- ✅ Portfolio-specific room subscriptions
- ✅ Automatic user room assignment
- ✅ Event-driven candle updates via EventEmitter
- ✅ Connection/disconnection tracking

## Connection

**Namespace**: `/mobile`

**Authentication**: JWT token required in handshake

### Client Connection (React Native / Web)

```typescript
import io from 'socket.io-client';

const socket = io('http://your-backend-url/mobile', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});
```

## Events

### Client → Server

#### Subscribe to Property Updates
```typescript
socket.emit('subscribe:property', { propertyId: 'property-uuid' });
```

#### Unsubscribe from Property Updates
```typescript
socket.emit('unsubscribe:property', { propertyId: 'property-uuid' });
```

### Server → Client

#### Candle Updated Event (Property Price History)
```typescript
socket.on('candle:updated', (data) => {
  console.log('Candle updated:', data);
  // {
  //   propertyId: string,
  //   candle: {
  //     date: Date,
  //     openPrice: number,
  //     highPrice: number,
  //     lowPrice: number,
  //     closePrice: number,
  //     volume: number,
  //     tradeCount: number
  //   },
  //   timestamp: Date
  // }
});
```

#### Portfolio Candle Updated Event
```typescript
socket.on('portfolio:candle:updated', (data) => {
  console.log('Portfolio candle updated:', data);
  // {
  //   userId: string,
  //   candle: {
  //     date: Date,
  //     openValue: number,
  //     highValue: number,
  //     lowValue: number,
  //     closeValue: number,
  //     totalInvested: number,
  //     snapshotCount: number
  //   },
  //   timestamp: Date
  // }
});
```

## How It Works

1. **Aggregation**: Scheduled tasks aggregate price events and portfolio snapshots into daily candles
2. **Event Emission**: After aggregation, `candle.updated` and `portfolio.candle.updated` events are emitted
3. **Event Listener**: `RealtimeGateway` listens to these events via `@OnEvent` decorators
4. **Broadcast**: The gateway broadcasts candle updates to subscribed clients in their respective rooms
5. **Client Receives**: Subscribed clients receive `candle:updated` or `portfolio:candle:updated` events

## Rooms

- `user:{userId}` - Automatically joined on connection
- `property:{propertyId}` - Joined when client subscribes to property updates
- `portfolio:{userId}` - Joined when client subscribes to portfolio updates

## Security

- JWT token validation on connection
- Unauthorized connections are rejected
- User ID extracted from JWT payload
- Socket-to-user mapping for tracking

## Serverless Note

⚠️ **Vercel Limitation**: WebSockets don't work with serverless functions. For production, you'll need:
- A persistent server (not serverless)
- Or use a WebSocket service (like Pusher, Ably, or Socket.io Cloud)

For local development, WebSockets work perfectly.


