# WebSocket Real-time Updates

## Overview

This WebSocket gateway provides real-time price history updates for the Blocks marketplace. When a trade is executed, all subscribed clients receive instant price updates.

## Features

- ✅ JWT authentication for secure connections
- ✅ Property-specific room subscriptions
- ✅ Automatic user room assignment
- ✅ Event-driven price updates via EventEmitter
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

#### Price Updated Event
```typescript
socket.on('price:updated', (data) => {
  console.log('Price updated:', data);
  // {
  //   propertyId: string,
  //   eventType: 'PURCHASE_EXECUTED',
  //   pricePerToken: number,
  //   quantity: number,
  //   timestamp: Date,
  //   eventId: string
  // }
});
```

## How It Works

1. **Trade Execution**: When a marketplace trade is executed, `TokenPriceHistoryService.recordMarketplaceTrade()` emits `price.event.created` event
2. **Event Listener**: `RealtimeGateway` listens to this event via `@OnEvent('price.event.created')`
3. **Broadcast**: The gateway broadcasts the update to all clients in the `property:{propertyId}` room
4. **Client Receives**: Subscribed clients receive the `price:updated` event in real-time

## Rooms

- `user:{userId}` - Automatically joined on connection
- `property:{propertyId}` - Joined when client subscribes to property updates

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


