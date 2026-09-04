import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/src/api';
import useAuthStore from '@/src/store/authStore';

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  API_URL;

let socketInstance: Socket | null = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      secure: true,
      withCredentials: true,
      forceNew: true,
      autoConnect: false,
      timeout: 20000,
      upgrade: false,
      rememberUpgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }

  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();
  const token = useAuthStore.getState().token;

  socket.auth = token ? { token } : {};

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socketInstance?.connected) {
    socketInstance.disconnect();
  }
}

export const socket = getSocket();
