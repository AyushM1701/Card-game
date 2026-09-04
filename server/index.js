// server/index.js — Express + Socket.IO entry point

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RoomManager from './RoomManager.js';
import GameManager from './GameManager.js';
import setupSocketHandlers from './socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:3000'];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // same-origin or server-to-server requests
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    if (parsed.hostname.endsWith('.onrender.com')) return true;
  } catch {}
  return false;
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    methods: ['GET', 'POST']
  }
});

// Managers
const roomManager = new RoomManager();
const gameManager = new GameManager();

// Per-socket event rate limiting middleware
io.use((socket, next) => {
  const eventTimestamps = [];
  const MAX_EVENTS_PER_SECOND = 25;

  socket.use(([event, ...args], packetNext) => {
    const now = Date.now();
    while (eventTimestamps.length > 0 && eventTimestamps[0] <= now - 1000) {
      eventTimestamps.shift();
    }
    if (eventTimestamps.length >= MAX_EVENTS_PER_SECOND) {
      console.warn(`[Security] Rate limit exceeded on socket ${socket.id} (event: ${event})`);
      return packetNext(new Error('Rate limit exceeded. Please slow down.'));
    }
    eventTimestamps.push(now);
    packetNext();
  });
  next();
});

// API routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: roomManager.rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/room/:code/status', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    status: room.status,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers
  });
});

// Serve static files in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Socket handlers
setupSocketHandlers(io, roomManager, gameManager);

// Start server
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`\n  🃏 MIND F*CK Server running on http://localhost:${PORT}\n`);
});
