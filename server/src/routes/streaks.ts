import { Router } from 'express';
import { API_ROUTES } from '@streaktrack/shared';
import type { DailyLog, StreakResponse, User } from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { calculateStreakStats } from '../utils/streakCalculator.js';

const router = Router();

interface DBUserRow {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  bio: string | null;
  join_date: string;
}

// ── GET /api/users ───────────────────────────────────────────
router.get(API_ROUTES.USERS, requireAuth, (_req, res) => {
  const rows = db
    .prepare('SELECT id, name, email, profile_picture, bio, join_date FROM users ORDER BY id ASC')
    .all() as DBUserRow[];

  const users: User[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    profilePicture: r.profile_picture,
    joinDate: r.join_date,
    bio: r.bio || 'Target: Product-based MNC as SDE 🎯',
  }));

  res.json({ users });
});

// ── GET /api/streaks/:userId ─────────────────────────────────
router.get(`${API_ROUTES.STREAKS}/:userId`, requireAuth, (req, res) => {
  const userId = parseInt(String(req.params.userId), 10);

  const userRow = db
    .prepare('SELECT id, name, email, profile_picture, bio, join_date FROM users WHERE id = ?')
    .get(userId) as DBUserRow | undefined;

  if (!userRow) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const user: User = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    profilePicture: userRow.profile_picture,
    joinDate: userRow.join_date,
    bio: userRow.bio || 'Target: Product-based MNC as SDE 🎯',
  };

  const logRows = db
    .prepare('SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE user_id = ? ORDER BY date ASC')
    .all(userId) as {
    id: number;
    user_id: number;
    date: string;
    topics_studied: string;
    hours_spent: number;
    notes: string | null;
    created_at: string;
  }[];

  const logs: DailyLog[] = logRows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    date: r.date,
    topicsStudied: r.topics_studied,
    hoursSpent: r.hours_spent,
    notes: r.notes,
    createdAt: r.created_at,
  }));

  const stats = calculateStreakStats(logs, 180);

  const response: StreakResponse = {
    user,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    totalHours: stats.totalHours,
    totalDaysLogged: stats.totalDaysLogged,
    calendarData: stats.calendarData,
  };

  res.json(response);
});

export default router;
