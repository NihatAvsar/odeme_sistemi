import { io, type Socket } from 'socket.io-client';
import { getAdminSecret } from '../api/admin-auth';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });
  }

  return socket;
}

export function getAdminSocket() {
  const adminSocket = getSocket();
  adminSocket.auth = { ...(adminSocket.auth as Record<string, unknown>), adminSecret: getAdminSecret() };
  return adminSocket;
}
