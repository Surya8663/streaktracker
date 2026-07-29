// ── API Routes ───────────────────────────────────────────────
export const API_ROUTES = {
  HEALTH: '/api/health',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_ME: '/api/auth/me',
  LOGS: '/api/logs',
  STREAKS: '/api/streaks',
  USERS: '/api/users',
  MILESTONES: '/api/milestones',
  ROADMAP: '/api/roadmap',
  PROFILE: '/api/profile',
  UPLOAD_AVATAR: '/api/profile/avatar',
} as const;

// ── Socket Event Names ───────────────────────────────────────
export const SOCKET_EVENTS = {
  SERVER_WELCOME: 'server:welcome',
  CLIENT_PING: 'client:ping',
  LOG_UPDATED: 'log:updated',
  PRESENCE_UPDATE: 'presence:update',
  MILESTONE_COMPLETED: 'milestone:completed',
} as const;

// ── App Metadata ─────────────────────────────────────────────
export const APP_NAME = 'StreakTrack';
export const APP_VERSION = '0.1.0';

