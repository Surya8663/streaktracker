import { Router } from 'express';
import { API_ROUTES } from '@streaktrack/shared';
import type { DailyLog, CreateDailyLogRequest, UpdateDailyLogRequest } from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastLogUpdate, broadcastMilestoneCompleted } from '../index.js';
import { computeMilestones } from '../utils/milestoneCalculator.js';

const router = Router();

// Helper to format Date to YYYY-MM-DD in local time
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Map SQL row to DailyLog interface
function mapRowToLog(row: {
  id: number;
  user_id: number;
  date: string;
  topics_studied: string;
  hours_spent: number;
  notes: string | null;
  created_at: string;
}): DailyLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    topicsStudied: row.topics_studied,
    hoursSpent: row.hours_spent,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ── GET /api/logs/:userId ────────────────────────────────────
router.get(`${API_ROUTES.LOGS}/:userId`, requireAuth, (req, res) => {
  const targetUserId = parseInt(String(req.params.userId), 10);

  if (isNaN(targetUserId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  const rows = db
    .prepare(
      'SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE user_id = ? ORDER BY date DESC, id DESC',
    )
    .all(targetUserId) as {
    id: number;
    user_id: number;
    date: string;
    topics_studied: string;
    hours_spent: number;
    notes: string | null;
    created_at: string;
  }[];

  const logs: DailyLog[] = rows.map(mapRowToLog);
  res.json({ logs });
});

// ── POST /api/logs ───────────────────────────────────────────
router.post(API_ROUTES.LOGS, requireAuth, (req, res) => {
  const userId = req.user!.id;
  const userName = req.user!.name;
  const { date, topicsStudied, hoursSpent, notes } = req.body as CreateDailyLogRequest;

  const logDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getTodayString();

  if (!topicsStudied || typeof topicsStudied !== 'string' || topicsStudied.trim() === '') {
    res.status(400).json({ message: 'Topics studied cannot be empty' });
    return;
  }

  const numericHours = Number(hoursSpent);
  if (isNaN(numericHours) || numericHours <= 0) {
    res.status(400).json({ message: 'Hours spent must be a positive number' });
    return;
  }

  // Check if an entry for today already exists
  const existing = db
    .prepare('SELECT id FROM daily_logs WHERE user_id = ? AND date = ?')
    .get(userId, logDate) as { id: number } | undefined;

  if (existing) {
    res.status(409).json({
      message: `An entry for ${logDate} already exists. Please update the existing entry.`,
      existingLogId: existing.id,
    });
    return;
  }

  try {
    const info = db
      .prepare(
        'INSERT INTO daily_logs (user_id, date, topics_studied, hours_spent, notes) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userId, logDate, topicsStudied.trim(), numericHours, notes ? notes.trim() : null);

    const createdRow = db
      .prepare(
        'SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE id = ?',
      )
      .get(info.lastInsertRowid) as {
      id: number;
      user_id: number;
      date: string;
      topics_studied: string;
      hours_spent: number;
      notes: string | null;
      created_at: string;
    };

    const newLog = mapRowToLog(createdRow);

    // Broadcast live event to all connected sockets!
    broadcastLogUpdate({
      userId,
      userName,
      log: newLog,
      isEdit: false,
    });

    // Check if any new milestones completed
    const { newlyCompleted } = computeMilestones();
    for (const milestone of newlyCompleted) {
      broadcastMilestoneCompleted({ milestone });
    }

    res.status(201).json({ log: newLog, message: 'Log created successfully' });
  } catch (err: unknown) {
    console.error('Error creating log:', err);
    res.status(500).json({ message: 'Failed to create log' });
  }
});

// ── PUT /api/logs/:id ────────────────────────────────────────
router.put(`${API_ROUTES.LOGS}/:id`, requireAuth, (req, res) => {
  const logId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const userName = req.user!.name;
  const { topicsStudied, hoursSpent, notes } = req.body as UpdateDailyLogRequest;

  // Check existence & ownership
  const existing = db
    .prepare('SELECT id, user_id FROM daily_logs WHERE id = ?')
    .get(logId) as { id: number; user_id: number } | undefined;

  if (!existing) {
    res.status(404).json({ message: 'Log entry not found' });
    return;
  }

  if (existing.user_id !== userId) {
    res.status(403).json({ message: 'Unauthorized to modify this log' });
    return;
  }

  if (topicsStudied !== undefined && (typeof topicsStudied !== 'string' || topicsStudied.trim() === '')) {
    res.status(400).json({ message: 'Topics studied cannot be empty' });
    return;
  }

  if (hoursSpent !== undefined) {
    const numericHours = Number(hoursSpent);
    if (isNaN(numericHours) || numericHours <= 0) {
      res.status(400).json({ message: 'Hours spent must be a positive number' });
      return;
    }
  }

  try {
    const current = db
      .prepare('SELECT topics_studied, hours_spent, notes FROM daily_logs WHERE id = ?')
      .get(logId) as { topics_studied: string; hours_spent: number; notes: string | null };

    const newTopics = topicsStudied !== undefined ? topicsStudied.trim() : current.topics_studied;
    const newHours = hoursSpent !== undefined ? Number(hoursSpent) : current.hours_spent;
    const newNotes = notes !== undefined ? (notes.trim() ? notes.trim() : null) : current.notes;

    db.prepare(
      'UPDATE daily_logs SET topics_studied = ?, hours_spent = ?, notes = ? WHERE id = ?',
    ).run(newTopics, newHours, newNotes, logId);

    const updatedRow = db
      .prepare(
        'SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE id = ?',
      )
      .get(logId) as {
      id: number;
      user_id: number;
      date: string;
      topics_studied: string;
      hours_spent: number;
      notes: string | null;
      created_at: string;
    };

    const updatedLog = mapRowToLog(updatedRow);

    // Broadcast live event to all connected sockets!
    broadcastLogUpdate({
      userId,
      userName,
      log: updatedLog,
      isEdit: true,
    });

    // Check if any new milestones completed
    const { newlyCompleted } = computeMilestones();
    for (const milestone of newlyCompleted) {
      broadcastMilestoneCompleted({ milestone });
    }

    res.json({ log: updatedLog, message: 'Log updated successfully' });
  } catch (err: unknown) {
    console.error('Error updating log:', err);
    res.status(500).json({ message: 'Failed to update log' });
  }
});

// ── DELETE /api/logs/:id ─────────────────────────────────────
router.delete(`${API_ROUTES.LOGS}/:id`, requireAuth, (req, res) => {
  const logId = parseInt(String(req.params.id), 10);
  const userId = req.user!.id;
  const userName = req.user!.name;

  const existing = db
    .prepare('SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE id = ?')
    .get(logId) as {
    id: number;
    user_id: number;
    date: string;
    topics_studied: string;
    hours_spent: number;
    notes: string | null;
    created_at: string;
  } | undefined;

  if (!existing) {
    res.status(404).json({ message: 'Log entry not found' });
    return;
  }

  if (existing.user_id !== userId) {
    res.status(403).json({ message: 'Unauthorized to delete this log' });
    return;
  }

  try {
    db.prepare('DELETE FROM daily_logs WHERE id = ?').run(logId);

    const deletedLog = mapRowToLog(existing);
    broadcastLogUpdate({
      userId,
      userName,
      log: deletedLog,
      isEdit: true,
    });

    res.json({ message: 'Log deleted successfully', deletedLogId: logId });
  } catch (err: unknown) {
    console.error('Error deleting log:', err);
    res.status(500).json({ message: 'Failed to delete log' });
  }
});

export default router;
