import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyTokenAndLoadUser } from '../middleware/auth';
import { listUserPortfolios } from '../services/portfolioService';

export type ServerEvent = {
  type: string;
  resource: 'property' | 'unit' | 'tenant' | 'rentRecord' | 'utilityBill' | 'maintenance' | 'payment' | 'portfolio';
  action: string;
  portfolioId: string;
  propertyId?: string;
  id?: string;
  data?: unknown;
  meta?: { monthKey?: string };
};

interface TrackedSocket extends WebSocket {
  isAlive?: boolean;
  portfolioIds?: Set<string>;
}

const HEARTBEAT_INTERVAL_MS = 25_000;

const rooms = new Map<string, Set<TrackedSocket>>();

const joinRoom = (portfolioId: string, socket: TrackedSocket) => {
  let room = rooms.get(portfolioId);
  if (!room) {
    room = new Set();
    rooms.set(portfolioId, room);
  }
  room.add(socket);
};

const leaveAllRooms = (socket: TrackedSocket) => {
  socket.portfolioIds?.forEach((portfolioId) => {
    const room = rooms.get(portfolioId);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0) rooms.delete(portfolioId);
  });
};

export const broadcastToPortfolio = (portfolioId: string, event: ServerEvent) => {
  const room = rooms.get(String(portfolioId));
  if (!room || !room.size) return;
  const payload = JSON.stringify(event);
  room.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
};

export const attachWebSocketServer = (httpServer: HttpServer) => {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (rawSocket, request) => {
    const socket = rawSocket as TrackedSocket;
    try {
      const url = new URL(request.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      const user = await verifyTokenAndLoadUser(token);
      const portfolios = await listUserPortfolios(user);
      socket.portfolioIds = new Set(portfolios.map((portfolio) => String(portfolio._id)));
      socket.portfolioIds.forEach((portfolioId) => joinRoom(portfolioId, socket));
      socket.isAlive = true;
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    socket.on('message', (raw) => {
      socket.isAlive = true;
      try {
        const message = JSON.parse(String(raw));
        if (message?.type === 'pong') {
          socket.isAlive = true;
        }
      } catch {
        // ignore malformed client messages
      }
    });

    socket.on('close', () => {
      leaveAllRooms(socket);
    });

    socket.on('error', () => {
      leaveAllRooms(socket);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((rawSocket) => {
      const socket = rawSocket as TrackedSocket;
      if (socket.isAlive === false) {
        leaveAllRooms(socket);
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
};
