import { Router } from 'express';
import { API_ROUTES } from '@streaktrack/shared';
import type {
  RoadmapPhase,
  RoadmapResponse,
  UpdateRoadmapPhaseRequest,
  Month1RoadmapResponse,
  RoadmapDay,
  RoadmapTask,
  UserRoadmapProfile,
  DailyRoadmapSession,
  UserProgressSummary,
  TaskCategory,
  CreateRoadmapTaskRequest,
  UpdateRoadmapTaskRequest,
  SaveDaySessionRequest,
} from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getKolkataDateString } from '../utils/timezone.js';
import { broadcastLogUpdate, broadcastRoadmapUpdate } from '../index.js';

const router = Router();

// Date helpers for 6-month placement roadmap
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

interface PhaseRow {
  id: number;
  phase_number: number;
  title: string;
  subtitle: string;
  start_day: number;
  end_day: number;
  target_hours: number;
  icon: string;
}

interface TaskRow {
  id: number;
  day_number: number;
  week_number: number;
  title: string;
  category: string;
  recommended_minutes: number;
  sort_order: number;
  created_at: string;
}

interface ProfileRow {
  user_id: number;
  status: 'not_started' | 'active' | 'completed';
  current_day: number;
  start_date: string | null;
  completion_date: string | null;
}

interface SessionRow {
  id: number;
  user_id: number;
  date: string;
  minutes_studied: number;
  notes: string | null;
  created_at: string;
}

interface UserRow {
  id: number;
  name: string;
  profile_picture: string | null;
}

const VALID_CATEGORIES: TaskCategory[] = ['DSA', 'LeetCode', 'Python', 'System Design', 'AI Engineer'];

function getUserSummaryProgress(userId: number, totalTasksInRoadmap: number): UserProgressSummary {
  const userRow = db.prepare('SELECT id, name, profile_picture FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  const profileRow = db.prepare('SELECT * FROM user_roadmap_profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;

  const completedCountRow = db
    .prepare('SELECT COUNT(*) as count FROM user_roadmap_tasks WHERE user_id = ? AND is_completed = 1')
    .get(userId) as { count: number };

  const minutesRow = db
    .prepare('SELECT COALESCE(SUM(minutes_studied), 0) as total_mins FROM daily_roadmap_sessions WHERE user_id = ?')
    .get(userId) as { total_mins: number };

  const completedTasksCount = completedCountRow.count;
  const totalMinutesStudied = minutesRow.total_mins;
  const percentComplete = totalTasksInRoadmap > 0 ? Math.min(100, Math.round((completedTasksCount / totalTasksInRoadmap) * 100)) : 0;

  return {
    userId,
    userName: userRow?.name || `User #${userId}`,
    userAvatar: userRow?.profile_picture || null,
    status: profileRow?.status || 'not_started',
    currentDay: profileRow?.current_day || 0,
    completedTasksCount,
    totalTasksCount: totalTasksInRoadmap,
    percentComplete,
    totalMinutesStudied,
    startDate: profileRow?.start_date || null,
    completionDate: profileRow?.completion_date || null,
  };
}

// ── GET /api/roadmap/month1 ──────────────────────────────────
router.get(API_ROUTES.ROADMAP_MONTH1, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;

    // Ensure user profile exists
    let profileRow = db.prepare('SELECT * FROM user_roadmap_profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;
    if (!profileRow) {
      db.prepare(
        'INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date) VALUES (?, ?, ?, ?, ?)',
      ).run(userId, 'not_started', 0, null, null);
      profileRow = { user_id: userId, status: 'not_started', current_day: 0, start_date: null, completion_date: null };
    }

    // Fetch all shared tasks
    const allTaskRows = db
      .prepare('SELECT * FROM roadmap_tasks ORDER BY day_number ASC, sort_order ASC, id ASC')
      .all() as TaskRow[];

    // Fetch signed-in user's completion states
    const userProgressRows = db
      .prepare('SELECT task_id, is_completed, completed_at FROM user_roadmap_tasks WHERE user_id = ?')
      .all(userId) as { task_id: number; is_completed: number; completed_at: string | null }[];

    const progressMap = new Map<number, { isCompleted: boolean; completedAt: string | null }>();
    for (const p of userProgressRows) {
      progressMap.set(p.task_id, { isCompleted: p.is_completed === 1, completedAt: p.completed_at });
    }

    // Fetch signed-in user's daily roadmap sessions
    const sessionRows = db
      .prepare('SELECT * FROM daily_roadmap_sessions WHERE user_id = ?')
      .all(userId) as SessionRow[];

    const sessionMap = new Map<string, DailyRoadmapSession>();
    for (const s of sessionRows) {
      sessionMap.set(s.date, {
        id: s.id,
        userId: s.user_id,
        date: s.date,
        minutesStudied: s.minutes_studied,
        notes: s.notes,
        createdAt: s.created_at,
      });
    }

    // Group tasks by day number (1 to 30)
    const daysMap = new Map<number, TaskRow[]>();
    for (let d = 1; d <= 30; d++) {
      daysMap.set(d, []);
    }
    for (const t of allTaskRows) {
      if (!daysMap.has(t.day_number)) {
        daysMap.set(t.day_number, []);
      }
      daysMap.get(t.day_number)!.push(t);
    }

    const days: RoadmapDay[] = [];
    for (let dayNum = 1; dayNum <= 30; dayNum++) {
      const taskRowsForDay = daysMap.get(dayNum) || [];
      const weekNumber = Math.ceil(dayNum / 7);

      const tasks: RoadmapTask[] = taskRowsForDay.map((t) => {
        const prog = progressMap.get(t.id);
        return {
          id: t.id,
          dayNumber: t.day_number,
          weekNumber: t.week_number,
          title: t.title,
          category: t.category as TaskCategory,
          recommendedMinutes: t.recommended_minutes,
          sortOrder: t.sort_order,
          isCompleted: prog?.isCompleted || false,
          completedAt: prog?.completedAt || null,
        };
      });

      const completedTasksCount = tasks.filter((t) => t.isCompleted).length;
      const totalTasksCount = tasks.length;
      const isCompleted = totalTasksCount > 0 && completedTasksCount === totalTasksCount;

      // Unlocked if Day 1 OR active and currentDay >= dayNum OR profile is completed
      const isUnlocked =
        dayNum === 1 ||
        profileRow.status === 'completed' ||
        (profileRow.status === 'active' && dayNum <= profileRow.current_day);

      // Match session for day (by date or latest session)
      const daySession = sessionRows.length > 0 ? (sessionMap.get(getKolkataDateString()) || null) : null;

      days.push({
        dayNumber: dayNum,
        weekNumber,
        tasks,
        session: daySession,
        isUnlocked,
        isCompleted,
        completedTasksCount,
        totalTasksCount,
      });
    }

    const totalTasksInRoadmap = allTaskRows.length;
    const myProgress = getUserSummaryProgress(userId, totalTasksInRoadmap);

    // Fetch partner progress
    const partnerUser = db
      .prepare('SELECT id FROM users WHERE id != ? ORDER BY id ASC LIMIT 1')
      .get(userId) as { id: number } | undefined;

    const partnerProgress = partnerUser ? getUserSummaryProgress(partnerUser.id, totalTasksInRoadmap) : null;

    const userProfile: UserRoadmapProfile = {
      userId: profileRow.user_id,
      status: profileRow.status,
      currentDay: profileRow.current_day,
      startDate: profileRow.start_date,
      completionDate: profileRow.completion_date,
      totalCompletedTasks: myProgress.completedTasksCount,
      totalTasks: totalTasksInRoadmap,
      totalMinutesStudied: myProgress.totalMinutesStudied,
    };

    const response: Month1RoadmapResponse = {
      days,
      userProfile,
      myProgress,
      partnerProgress,
    };

    res.json(response);
  } catch (err: unknown) {
    console.error('Error fetching month1 roadmap:', err);
    res.status(500).json({ message: 'Failed to fetch Month 1 Roadmap' });
  }
});

// ── POST /api/roadmap/month1/start ───────────────────────────
router.post(`${API_ROUTES.ROADMAP_MONTH1}/start`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const todayKolkata = getKolkataDateString();

    const existing = db.prepare('SELECT * FROM user_roadmap_profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;

    const newStatus = 'active';
    const newCurrentDay = existing && existing.current_day > 0 ? existing.current_day : 1;
    const newStartDate = existing?.start_date || todayKolkata;

    db.prepare(`
      INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
      VALUES (?, ?, ?, ?, NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        status = excluded.status,
        current_day = excluded.current_day,
        start_date = COALESCE(user_roadmap_profiles.start_date, excluded.start_date)
    `).run(userId, newStatus, newCurrentDay, newStartDate);

    broadcastRoadmapUpdate({
      userId,
      type: 'start',
      dayNumber: newCurrentDay,
    });

    res.json({
      message: 'Roadmap started successfully at Day 1',
      profile: {
        userId,
        status: newStatus,
        currentDay: newCurrentDay,
        startDate: newStartDate,
        completionDate: null,
      },
    });
  } catch (err: unknown) {
    console.error('Error starting roadmap:', err);
    res.status(500).json({ message: 'Failed to start roadmap' });
  }
});

// ── PATCH /api/roadmap/tasks/:taskId/progress ───────────────
router.patch(`${API_ROUTES.ROADMAP_TASKS}/:taskId/progress`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const taskId = parseInt(String(req.params.taskId), 10);
    const { isCompleted } = req.body as { isCompleted?: boolean };

    if (typeof isCompleted !== 'boolean') {
      res.status(400).json({ message: 'isCompleted field must be a boolean' });
      return;
    }

    const taskRow = db.prepare('SELECT id, day_number FROM roadmap_tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!taskRow) {
      res.status(404).json({ message: 'Roadmap task not found' });
      return;
    }

    const completedAt = isCompleted ? new Date().toISOString() : null;

    db.prepare(`
      INSERT INTO user_roadmap_tasks (user_id, task_id, is_completed, completed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, task_id) DO UPDATE SET
        is_completed = excluded.is_completed,
        completed_at = excluded.completed_at
    `).run(userId, taskId, isCompleted ? 1 : 0, completedAt);

    broadcastRoadmapUpdate({
      userId,
      type: 'progress',
      taskId,
      dayNumber: taskRow.day_number,
    });

    res.json({
      message: 'Task progress updated',
      taskId,
      isCompleted,
      completedAt,
    });
  } catch (err: unknown) {
    console.error('Error updating task progress:', err);
    res.status(500).json({ message: 'Failed to update task progress' });
  }
});

// ── POST /api/roadmap/month1/days/:dayNumber/save ───────────
router.post(`${API_ROUTES.ROADMAP_MONTH1}/days/:dayNumber/save`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const dayNumber = parseInt(String(req.params.dayNumber), 10);
    const { minutesStudied, notes } = req.body as SaveDaySessionRequest;

    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      res.status(400).json({ message: 'Day number must be between 1 and 30' });
      return;
    }

    if (typeof minutesStudied !== 'number' || minutesStudied <= 0) {
      res.status(400).json({ message: 'minutesStudied must be a positive number' });
      return;
    }

    let profileRow = db.prepare('SELECT * FROM user_roadmap_profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;
    if (!profileRow || profileRow.status === 'not_started') {
      res.status(400).json({ message: 'Please start your Month 1 Roadmap first before saving daily progress.' });
      return;
    }

    // Rule 1: A day can be saved ONLY after at least one task is checked for that day.
    const completedTasksRow = db
      .prepare(`
        SELECT COUNT(*) as count FROM user_roadmap_tasks urt
        JOIN roadmap_tasks rt ON urt.task_id = rt.id
        WHERE urt.user_id = ? AND rt.day_number = ? AND urt.is_completed = 1
      `)
      .get(userId, dayNumber) as { count: number };

    if (completedTasksRow.count === 0) {
      res.status(400).json({
        message: `At least one task in Day ${dayNumber} must be completed before saving progress.`,
      });
      return;
    }

    // Rule 2: Future days cannot be saved before current day.
    if (profileRow.status !== 'completed' && dayNumber > profileRow.current_day) {
      res.status(400).json({
        message: `Cannot save Day ${dayNumber} before reaching it. Your current active day is Day ${profileRow.current_day}.`,
      });
      return;
    }

    const kolkataDate = getKolkataDateString();

    // 1. Save session to daily_roadmap_sessions
    db.prepare(`
      INSERT INTO daily_roadmap_sessions (user_id, date, minutes_studied, notes)
      VALUES (?, ?, ?, ?)
    `).run(userId, kolkataDate, minutesStudied, notes || null);

    // 2. Auto-sync to daily_logs for Streak Calendar
    const completedTaskTitlesRow = db
      .prepare(`
        SELECT rt.title FROM user_roadmap_tasks urt
        JOIN roadmap_tasks rt ON urt.task_id = rt.id
        WHERE urt.user_id = ? AND rt.day_number = ? AND urt.is_completed = 1
        ORDER BY rt.sort_order ASC
      `)
      .all(userId, dayNumber) as { title: string }[];

    const topicsStudied = `Day ${dayNumber}: ` + completedTaskTitlesRow.map((t) => t.title).join(', ');
    const hoursSpent = Number((minutesStudied / 60).toFixed(2));

    db.prepare(`
      INSERT INTO daily_logs (user_id, date, topics_studied, hours_spent, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        topics_studied = excluded.topics_studied,
        hours_spent = daily_logs.hours_spent + excluded.hours_spent,
        notes = COALESCE(excluded.notes, daily_logs.notes)
    `).run(userId, kolkataDate, topicsStudied, hoursSpent, notes || null);

    // Broadcast log updated event for live streak calendar refresh
    const userRow = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string };
    const latestLog = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?').get(userId, kolkataDate) as {
      id: number;
      user_id: number;
      date: string;
      topics_studied: string;
      hours_spent: number;
      notes: string | null;
      created_at: string;
    };

    broadcastLogUpdate({
      userId,
      userName: userRow?.name || 'User',
      log: {
        id: latestLog.id,
        userId: latestLog.user_id,
        date: latestLog.date,
        topicsStudied: latestLog.topics_studied,
        hoursSpent: latestLog.hours_spent,
        notes: latestLog.notes,
        createdAt: latestLog.created_at,
      },
      isEdit: false,
    });

    // 3. Advance currentDay or mark completed if Day 30
    let nextDay = profileRow.current_day;
    let newStatus = profileRow.status;
    let completionDate = profileRow.completion_date;

    if (dayNumber === 30) {
      newStatus = 'completed';
      completionDate = kolkataDate;
      nextDay = 30;
    } else {
      nextDay = Math.max(profileRow.current_day, dayNumber + 1);
    }

    db.prepare(`
      UPDATE user_roadmap_profiles
      SET status = ?, current_day = ?, completion_date = ?
      WHERE user_id = ?
    `).run(newStatus, nextDay, completionDate, userId);

    broadcastRoadmapUpdate({
      userId,
      type: 'save_day',
      dayNumber,
    });

    res.json({
      message: `Day ${dayNumber} saved successfully and synced to streak calendar!`,
      currentDay: nextDay,
      status: newStatus,
      session: {
        userId,
        date: kolkataDate,
        minutesStudied,
        notes: notes || null,
      },
      syncedLog: {
        date: kolkataDate,
        hoursSpent,
        topicsStudied,
      },
    });
  } catch (err: unknown) {
    console.error('Error saving roadmap day:', err);
    res.status(500).json({ message: 'Failed to save roadmap day session' });
  }
});

// ── POST /api/roadmap/tasks (Add Shared Task) ────────────────
router.post(API_ROUTES.ROADMAP_TASKS, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const { dayNumber, weekNumber, title, category, recommendedMinutes, sortOrder } = req.body as CreateRoadmapTaskRequest;

    if (!title || !title.trim()) {
      res.status(400).json({ message: 'Task title is required' });
      return;
    }

    if (typeof dayNumber !== 'number' || dayNumber < 1 || dayNumber > 30) {
      res.status(400).json({ message: 'dayNumber must be between 1 and 30' });
      return;
    }

    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }

    if (typeof recommendedMinutes !== 'number' || recommendedMinutes <= 0) {
      res.status(400).json({ message: 'recommendedMinutes must be a positive number' });
      return;
    }

    const calculatedWeek = weekNumber || Math.ceil(dayNumber / 7);
    const calculatedSort = typeof sortOrder === 'number' ? sortOrder : 1;

    const result = db.prepare(`
      INSERT INTO roadmap_tasks (day_number, week_number, title, category, recommended_minutes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(dayNumber, calculatedWeek, title.trim(), category, recommendedMinutes, calculatedSort);

    const newTask = db.prepare('SELECT * FROM roadmap_tasks WHERE id = ?').get(result.lastInsertRowid) as TaskRow;

    broadcastRoadmapUpdate({
      userId,
      type: 'task_crud',
      taskId: newTask.id,
      dayNumber: newTask.day_number,
    });

    res.status(201).json({
      message: 'Shared task added successfully',
      task: {
        id: newTask.id,
        dayNumber: newTask.day_number,
        weekNumber: newTask.week_number,
        title: newTask.title,
        category: newTask.category as TaskCategory,
        recommendedMinutes: newTask.recommended_minutes,
        sortOrder: newTask.sort_order,
      },
    });
  } catch (err: unknown) {
    console.error('Error creating roadmap task:', err);
    res.status(500).json({ message: 'Failed to create roadmap task' });
  }
});

// ── PUT /api/roadmap/tasks/:taskId (Update Shared Task) ─────
router.put(`${API_ROUTES.ROADMAP_TASKS}/:taskId`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const taskId = parseInt(String(req.params.taskId), 10);
    const { dayNumber, weekNumber, title, category, recommendedMinutes, sortOrder } = req.body as UpdateRoadmapTaskRequest;

    const existing = db.prepare('SELECT * FROM roadmap_tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!existing) {
      res.status(404).json({ message: 'Roadmap task not found' });
      return;
    }

    const newDay = typeof dayNumber === 'number' ? dayNumber : existing.day_number;
    const newWeek = typeof weekNumber === 'number' ? weekNumber : (typeof dayNumber === 'number' ? Math.ceil(dayNumber / 7) : existing.week_number);
    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newCategory = category !== undefined ? category : existing.category;
    const newMins = typeof recommendedMinutes === 'number' ? recommendedMinutes : existing.recommended_minutes;
    const newSort = typeof sortOrder === 'number' ? sortOrder : existing.sort_order;

    if (!newTitle) {
      res.status(400).json({ message: 'Title cannot be empty' });
      return;
    }

    if (!VALID_CATEGORIES.includes(newCategory as TaskCategory)) {
      res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }

    db.prepare(`
      UPDATE roadmap_tasks
      SET day_number = ?, week_number = ?, title = ?, category = ?, recommended_minutes = ?, sort_order = ?
      WHERE id = ?
    `).run(newDay, newWeek, newTitle, newCategory, newMins, newSort, taskId);

    broadcastRoadmapUpdate({
      userId,
      type: 'task_crud',
      taskId,
      dayNumber: newDay,
    });

    res.json({
      message: 'Roadmap task updated successfully',
      task: {
        id: taskId,
        dayNumber: newDay,
        weekNumber: newWeek,
        title: newTitle,
        category: newCategory as TaskCategory,
        recommendedMinutes: newMins,
        sortOrder: newSort,
      },
    });
  } catch (err: unknown) {
    console.error('Error updating roadmap task:', err);
    res.status(500).json({ message: 'Failed to update roadmap task' });
  }
});

// ── DELETE /api/roadmap/tasks/:taskId (Delete Shared Task) ──
router.delete(`${API_ROUTES.ROADMAP_TASKS}/:taskId`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const taskId = parseInt(String(req.params.taskId), 10);

    const existing = db.prepare('SELECT * FROM roadmap_tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!existing) {
      res.status(404).json({ message: 'Roadmap task not found' });
      return;
    }

    const deleteTransaction = db.transaction((id: number) => {
      db.prepare('DELETE FROM user_roadmap_tasks WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM roadmap_tasks WHERE id = ?').run(id);
    });

    deleteTransaction(taskId);

    broadcastRoadmapUpdate({
      userId,
      type: 'task_crud',
      taskId,
      dayNumber: existing.day_number,
    });

    res.json({ message: 'Roadmap task deleted successfully', taskId });
  } catch (err: unknown) {
    console.error('Error deleting roadmap task:', err);
    res.status(500).json({ message: 'Failed to delete roadmap task' });
  }
});

// ── GET /api/roadmap (6-Month Placement Roadmap Phases) ───────
router.get(API_ROUTES.ROADMAP, requireAuth, (_req, res) => {
  try {
    const earliestRow = db
      .prepare('SELECT MIN(date) as earliest FROM daily_logs')
      .get() as { earliest: string | null };

    const startDateStr = earliestRow?.earliest || formatDate(new Date());
    const startDateObj = parseDate(startDateStr);
    const todayObj = new Date();
    const todayStr = formatDate(todayObj);

    const diffTime = todayObj.getTime() - startDateObj.getTime();
    const daysElapsedTotal = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const targetEndDateObj = addDays(startDateObj, 179);
    const targetEndDateStr = formatDate(targetEndDateObj);

    const totalHoursRow = db
      .prepare('SELECT COALESCE(SUM(hours_spent), 0) as total_hours FROM daily_logs')
      .get() as { total_hours: number };
    const totalHoursLogged = totalHoursRow.total_hours;

    const phaseRows = db
      .prepare('SELECT * FROM roadmap_phases ORDER BY phase_number ASC')
      .all() as PhaseRow[];

    const phases: RoadmapPhase[] = phaseRows.map((p) => {
      const phaseStartDate = addDays(startDateObj, p.start_day - 1);
      const phaseEndDate = addDays(startDateObj, p.end_day - 1);

      const phaseStartStr = formatDate(phaseStartDate);
      const phaseEndStr = formatDate(phaseEndDate);

      const phaseHoursRow = db
        .prepare(
          'SELECT COALESCE(SUM(hours_spent), 0) as phase_hours FROM daily_logs WHERE date >= ? AND date <= ?',
        )
        .get(phaseStartStr, phaseEndStr) as { phase_hours: number };

      const actualHours = phaseHoursRow.phase_hours;

      let daysElapsedInPhase = 0;
      if (todayStr >= phaseStartStr) {
        if (todayStr >= phaseEndStr) {
          daysElapsedInPhase = p.end_day - p.start_day + 1;
        } else {
          daysElapsedInPhase = Math.max(
            1,
            Math.floor((todayObj.getTime() - phaseStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
          );
        }
      }

      const totalDaysInPhase = p.end_day - p.start_day + 1;
      const isUnlocked = daysElapsedTotal >= p.start_day || actualHours > 0;
      const isCompleted = actualHours >= p.target_hours || daysElapsedTotal > p.end_day;
      const percentComplete = Math.min(100, Math.round((actualHours / p.target_hours) * 100));

      return {
        id: p.id,
        phaseNumber: p.phase_number,
        title: p.title,
        subtitle: p.subtitle,
        startDay: p.start_day,
        endDay: p.end_day,
        targetHours: p.target_hours,
        icon: p.icon,
        actualHours,
        daysElapsedInPhase,
        totalDaysInPhase,
        isUnlocked,
        isCompleted,
        percentComplete,
      };
    });

    const percentDays = Math.min(100, Math.round((daysElapsedTotal / 180) * 100));

    const response: RoadmapResponse = {
      phases,
      overallProgress: {
        daysElapsed: daysElapsedTotal,
        totalDays: 180,
        percentDays,
        totalHoursLogged,
        startDate: startDateStr,
        targetEndDate: targetEndDateStr,
      },
    };

    res.json(response);
  } catch (err: unknown) {
    console.error('Error fetching roadmap:', err);
    res.status(500).json({ message: 'Failed to fetch roadmap' });
  }
});

// ── PUT /api/roadmap/phases/:id ──────────────────────────────
router.put(`${API_ROUTES.ROADMAP}/phases/:id`, requireAuth, (req, res) => {
  const phaseId = parseInt(String(req.params.id), 10);
  const { title, subtitle, targetHours, icon } = req.body as UpdateRoadmapPhaseRequest;

  const existing = db
    .prepare('SELECT id FROM roadmap_phases WHERE id = ?')
    .get(phaseId);

  if (!existing) {
    res.status(404).json({ message: 'Roadmap phase not found' });
    return;
  }

  try {
    const current = db
      .prepare('SELECT title, subtitle, target_hours, icon FROM roadmap_phases WHERE id = ?')
      .get(phaseId) as { title: string; subtitle: string; target_hours: number; icon: string };

    const newTitle = title !== undefined ? title.trim() : current.title;
    const newSubtitle = subtitle !== undefined ? subtitle.trim() : current.subtitle;
    const newHours = targetHours !== undefined ? Number(targetHours) : current.target_hours;
    const newIcon = icon !== undefined ? icon.trim() : current.icon;

    if (!newTitle) {
      res.status(400).json({ message: 'Title cannot be empty' });
      return;
    }

    if (isNaN(newHours) || newHours <= 0) {
      res.status(400).json({ message: 'Target hours must be a positive number' });
      return;
    }

    db.prepare(
      'UPDATE roadmap_phases SET title = ?, subtitle = ?, target_hours = ?, icon = ? WHERE id = ?',
    ).run(newTitle, newSubtitle, newHours, newIcon, phaseId);

    res.json({ message: 'Phase updated successfully' });
  } catch (err: unknown) {
    console.error('Error updating phase:', err);
    res.status(500).json({ message: 'Failed to update phase' });
  }
});

// ── Shared Source Vault Types & Endpoints ────────────────────
interface SourceRow {
  id: number;
  category: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface SourceLinkRow {
  id: number;
  source_id: number;
  title: string;
  url: string;
  note: string | null;
  added_by_user_id: number;
  user_name: string;
  user_avatar: string | null;
  created_at: string;
}

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/roadmap/sources
router.get(API_ROUTES.ROADMAP_SOURCES, requireAuth, (_req, res) => {
  try {
    const sourceRows = db
      .prepare('SELECT * FROM roadmap_sources ORDER BY category ASC, sort_order ASC, name ASC')
      .all() as SourceRow[];

    const linkRows = db
      .prepare(`
        SELECT l.*, u.name as user_name, u.profile_picture as user_avatar
        FROM roadmap_source_links l
        JOIN users u ON l.added_by_user_id = u.id
        ORDER BY l.created_at DESC
      `)
      .all() as SourceLinkRow[];

    const linksMap = new Map<number, any[]>();
    for (const link of linkRows) {
      if (!linksMap.has(link.source_id)) {
        linksMap.set(link.source_id, []);
      }
      linksMap.get(link.source_id)!.push({
        id: link.id,
        sourceId: link.source_id,
        title: link.title,
        url: link.url,
        note: link.note,
        addedByUserId: link.added_by_user_id,
        addedByName: link.user_name,
        addedByAvatar: link.user_avatar,
        createdAt: link.created_at,
      });
    }

    const sources = sourceRows.map((s) => ({
      id: s.id,
      category: s.category,
      name: s.name,
      sortOrder: s.sort_order,
      createdAt: s.created_at,
      links: linksMap.get(s.id) || [],
    }));

    res.json(sources);
  } catch (err: unknown) {
    console.error('Error fetching roadmap sources:', err);
    res.status(500).json({ message: 'Failed to fetch roadmap sources' });
  }
});

// POST /api/roadmap/sources (Create Source Group)
router.post(API_ROUTES.ROADMAP_SOURCES, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const { category, name, sortOrder } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Source group name is required' });
      return;
    }

    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }

    const sort = typeof sortOrder === 'number' ? sortOrder : 1;

    const result = db
      .prepare('INSERT INTO roadmap_sources (category, name, sort_order) VALUES (?, ?, ?)')
      .run(category, name.trim(), sort);

    broadcastRoadmapUpdate({
      userId,
      type: 'source_crud',
    });

    res.status(201).json({
      message: 'Source group added successfully',
      source: {
        id: Number(result.lastInsertRowid),
        category,
        name: name.trim(),
        sortOrder: sort,
        links: [],
      },
    });
  } catch (err: unknown) {
    console.error('Error creating source group:', err);
    res.status(500).json({ message: 'Failed to create source group' });
  }
});

// POST /api/roadmap/sources/:sourceId/links (Add Link)
router.post(`${API_ROUTES.ROADMAP_SOURCES}/:sourceId/links`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const sourceId = parseInt(String(req.params.sourceId), 10);
    const { title, url, note } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ message: 'Link title is required' });
      return;
    }

    if (!url || !url.trim() || !isValidHttpUrl(url.trim())) {
      res.status(400).json({ message: 'Invalid URL. Must be a valid link starting with http:// or https://' });
      return;
    }

    const sourceExists = db.prepare('SELECT id FROM roadmap_sources WHERE id = ?').get(sourceId);
    if (!sourceExists) {
      res.status(404).json({ message: 'Source group not found' });
      return;
    }

    const result = db
      .prepare(`
        INSERT INTO roadmap_source_links (source_id, title, url, note, added_by_user_id)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(sourceId, title.trim(), url.trim(), note ? note.trim() : null, userId);

    const userRow = db.prepare('SELECT name, profile_picture FROM users WHERE id = ?').get(userId) as UserRow;

    broadcastRoadmapUpdate({
      userId,
      type: 'source_crud',
    });

    res.status(201).json({
      message: 'Link added to source vault successfully!',
      link: {
        id: Number(result.lastInsertRowid),
        sourceId,
        title: title.trim(),
        url: url.trim(),
        note: note ? note.trim() : null,
        addedByUserId: userId,
        addedByName: userRow?.name || 'User',
        addedByAvatar: userRow?.profile_picture || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error('Error adding source link:', err);
    res.status(500).json({ message: 'Failed to add link to source vault' });
  }
});

// PUT /api/roadmap/source-links/:linkId (Edit Link)
router.put(`${API_ROUTES.ROADMAP}/source-links/:linkId`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.linkId), 10);
    const { title, url, note } = req.body;

    const existing = db.prepare('SELECT * FROM roadmap_source_links WHERE id = ?').get(linkId) as {
      id: number;
      title: string;
      url: string;
      note: string | null;
    } | undefined;

    if (!existing) {
      res.status(404).json({ message: 'Source link not found' });
      return;
    }

    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newUrl = url !== undefined ? url.trim() : existing.url;
    const newNote = note !== undefined ? (note ? note.trim() : null) : existing.note;

    if (!newTitle) {
      res.status(400).json({ message: 'Title cannot be empty' });
      return;
    }

    if (!newUrl || !isValidHttpUrl(newUrl)) {
      res.status(400).json({ message: 'Invalid URL. Must start with http:// or https://' });
      return;
    }

    db.prepare(`
      UPDATE roadmap_source_links
      SET title = ?, url = ?, note = ?
      WHERE id = ?
    `).run(newTitle, newUrl, newNote, linkId);

    broadcastRoadmapUpdate({
      userId,
      type: 'source_crud',
    });

    res.json({ message: 'Source link updated successfully' });
  } catch (err: unknown) {
    console.error('Error updating source link:', err);
    res.status(500).json({ message: 'Failed to update source link' });
  }
});

// DELETE /api/roadmap/source-links/:linkId
router.delete(`${API_ROUTES.ROADMAP}/source-links/:linkId`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const linkId = parseInt(String(req.params.linkId), 10);

    const existing = db.prepare('SELECT id FROM roadmap_source_links WHERE id = ?').get(linkId);
    if (!existing) {
      res.status(404).json({ message: 'Source link not found' });
      return;
    }

    db.prepare('DELETE FROM roadmap_source_links WHERE id = ?').run(linkId);

    broadcastRoadmapUpdate({
      userId,
      type: 'source_crud',
    });

    res.json({ message: 'Source link deleted successfully', linkId });
  } catch (err: unknown) {
    console.error('Error deleting source link:', err);
    res.status(500).json({ message: 'Failed to delete source link' });
  }
});

// DELETE /api/roadmap/sources/:sourceId
router.delete(`${API_ROUTES.ROADMAP_SOURCES}/:sourceId`, requireAuth, (req, res) => {
  try {
    const userId = req.user!.id;
    const sourceId = parseInt(String(req.params.sourceId), 10);

    const existing = db.prepare('SELECT id FROM roadmap_sources WHERE id = ?').get(sourceId);
    if (!existing) {
      res.status(404).json({ message: 'Source group not found' });
      return;
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM roadmap_source_links WHERE source_id = ?').run(sourceId);
      db.prepare('DELETE FROM roadmap_sources WHERE id = ?').run(sourceId);
    });

    deleteTransaction();

    broadcastRoadmapUpdate({
      userId,
      type: 'source_crud',
    });

    res.json({ message: 'Source group deleted successfully', sourceId });
  } catch (err: unknown) {
    console.error('Error deleting source group:', err);
    res.status(500).json({ message: 'Failed to delete source group' });
  }
});

export default router;
