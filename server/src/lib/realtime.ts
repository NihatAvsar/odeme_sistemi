import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';

export type RealtimeEvents = {
  'order.updated': (payload: { tableId: string; orderId: string }) => void;
  'payment.updated': (payload: { tableId: string; paymentId: string; status: string }) => void;
  'table.updated': (payload: { tableId: string; status: string }) => void;
  'order-request.created': (payload: { tableId: string; orderRequestId: string }) => void;
  'order-request.updated': (payload: { tableId: string; orderRequestId: string; status: string }) => void;
  'menu.updated': (payload: { restaurantId: string }) => void;
  'kitchen.ticket.created': (payload: { restaurantId: string; orderId: string }) => void;
  'kitchen.ticket.updated': (payload: { restaurantId: string; orderItemId: string; status: string }) => void;
};

export class RealtimeGateway {
  private io: SocketIOServer | null = null;

  attach(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: env.corsOrigin,
        credentials: true,
      },
    });

    this.io.on('connection', (socket) => {
      socket.on('table:join', (tableId: string) => {
        socket.join(`table:${tableId}`);
      });

      socket.on('order:join', (orderId: string) => {
        socket.join(`order:${orderId}`);
      });

      socket.on('restaurant:join', (restaurantId: string) => {
        socket.join(`restaurant:${restaurantId}`);
      });

      // Admin paneli tüm restaurant event'lerini dinlemek için
      socket.on('admin:join', (restaurantId: string) => {
        socket.join(`restaurant:${restaurantId}`);
      });
    });
  }

  emitToTable<T extends keyof RealtimeEvents>(tableId: string, event: T, payload: Parameters<RealtimeEvents[T]>[0]) {
    this.io?.to(`table:${tableId}`).emit(event, payload);
  }

  emitToOrder<T extends keyof RealtimeEvents>(orderId: string, event: T, payload: Parameters<RealtimeEvents[T]>[0]) {
    this.io?.to(`order:${orderId}`).emit(event, payload);
  }

  emitToRestaurant<T extends keyof RealtimeEvents>(restaurantId: string, event: T, payload: Parameters<RealtimeEvents[T]>[0]) {
    this.io?.to(`restaurant:${restaurantId}`).emit(event, payload);
  }
}

export const realtimeGateway = new RealtimeGateway();
