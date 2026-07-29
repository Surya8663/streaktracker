import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import { API_ROUTES, SOCKET_EVENTS, APP_NAME, APP_VERSION } from '@streaktrack/shared';
import type {
  HealthCheckResponse,
  ServerToClientEvents,
  ClientToServerEvents,
  AuthUser,
  LogUpdatedPayload,
  MilestoneWonPayload,
} from '@streaktrack/shared';

// Initialize database (side-effect: creates file + tables)
import './db.js';

// Routes
import authRoutes from './routes/auth.js';
import logsRoutes from './routes/logs.js';
import streaksRoutes from './routes/streaks.js';
import milestonesRoutes from './routes/milestones.js';
import roadmapRoutes from './routes/roadmap.js';
import profileRoutes from './routes/profile.js';

const JWT_SECRET = process.env.JWT_SECRET || 'streaktrack-dev-secret-change-me';

// ── Express ──────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Parse CLIENT_URL into array of allowed origins for production CORS
const allowedOrigins = CLIENT_URL.split(',').map((u) => u.trim());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or if origin is in allowedOrigins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true); // Allow origin dynamically for easy deployment
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// ── Routes ───────────────────────────────────────────────────
app.use(authRoutes);
app.use(logsRoutes);
app.use(streaksRoutes);
app.use(milestonesRoutes);
app.use(roadmapRoutes);
app.use(profileRoutes);

// ── Health Check ─────────────────────────────────────────────
app.get(API_ROUTES.HEALTH, (_req, res) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  res.json(response);
});

// ── Socket.io ────────────────────────────────────────────────
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true); // Allow socket connection cross-origin
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Map of userId -> Set of active socket IDs
const onlineUsersMap = new Map<number, Set<string>>();

// Middleware to extract cookie/auth from Socket handshake
io.use((socket, next) => {
  const cookieHeader = socket.request.headers.cookie;
  if (!cookieHeader) return next();

  // Simple cookie parser for token
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c) => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    }),
  );

  const token = cookies.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
      (socket as unknown as { user: AuthUser }).user = payload;
    } catch {
      // Ignore token verification errors during handshake
    }
  }
  next();
});

function getOnlineUserIds(): number[] {
  return Array.from(onlineUsersMap.keys());
}

function broadcastPresence() {
  io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
    onlineUserIds: getOnlineUserIds(),
  });
}

export function broadcastLogUpdate(payload: LogUpdatedPayload) {
  io.emit(SOCKET_EVENTS.LOG_UPDATED, payload);
}

export function broadcastMilestoneCompleted(payload: MilestoneWonPayload) {
  io.emit(SOCKET_EVENTS.MILESTONE_COMPLETED, payload);
}

io.on('connection', (socket) => {
  const user = (socket as unknown as { user?: AuthUser }).user;

  if (user) {
    console.log(`[socket] Client connected: ${socket.id} (${user.name} #${user.id})`);
    if (!onlineUsersMap.has(user.id)) {
      onlineUsersMap.set(user.id, new Set());
    }
    onlineUsersMap.get(user.id)!.add(socket.id);
    broadcastPresence();
  } else {
    console.log(`[socket] Anonymous client connected: ${socket.id}`);
  }

  // Send a welcome message
  socket.emit(SOCKET_EVENTS.SERVER_WELCOME, `Welcome to ${APP_NAME} v${APP_VERSION}!`);

  socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
    console.log(`[socket] Ping from ${socket.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] Client disconnected: ${socket.id} (${reason})`);
    if (user && onlineUsersMap.has(user.id)) {
      const set = onlineUsersMap.get(user.id)!;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsersMap.delete(user.id);
      }
      broadcastPresence();
    }
  });
});

// ── Anti-Sleep Keepalive Ping (for Render/Railway free tier) ──
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) {
  const PING_INTERVAL = 14 * 60 * 1000; // Ping every 14 minutes
  setInterval(() => {
    fetch(`${SELF_URL}${API_ROUTES.HEALTH}`)
      .then(() => console.log(`[keepalive] Self-pinged ${SELF_URL} successfully`))
      .catch((err) => console.error('[keepalive] Self-ping failed:', err.message));
  }, PING_INTERVAL);
  console.log(`[keepalive] Registered 14-min self-ping target: ${SELF_URL}`);
}

// ── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n  🔥 ${APP_NAME} server v${APP_VERSION}`);
  console.log(`  ➜ Local:   http://localhost:${PORT}`);
  console.log(`  ➜ Health:  http://localhost:${PORT}${API_ROUTES.HEALTH}`);
  console.log(`  ➜ Client:  ${CLIENT_URL}\n`);
});
