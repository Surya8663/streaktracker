import { Router } from 'express';
import { API_ROUTES } from '@streaktrack/shared';
import type { RoadmapPhase, RoadmapResponse, UpdateRoadmapPhaseRequest } from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Date helpers
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

// ── GET /api/roadmap ─────────────────────────────────────────
router.get(API_ROUTES.ROADMAP, requireAuth, (_req, res) => {
  try {
    // 1. Fetch earliest log date across both users (Day 1 anchor)
    const earliestRow = db
      .prepare('SELECT MIN(date) as earliest FROM daily_logs')
      .get() as { earliest: string | null };

    const startDateStr = earliestRow?.earliest || formatDate(new Date());
    const startDateObj = parseDate(startDateStr);
    const todayObj = new Date();
    const todayStr = formatDate(todayObj);

    // Days elapsed since start date (Day 1)
    const diffTime = todayObj.getTime() - startDateObj.getTime();
    const daysElapsedTotal = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const targetEndDateObj = addDays(startDateObj, 179); // 180 days total
    const targetEndDateStr = formatDate(targetEndDateObj);

    // Total hours logged across all users
    const totalHoursRow = db
      .prepare('SELECT COALESCE(SUM(hours_spent), 0) as total_hours FROM daily_logs')
      .get() as { total_hours: number };
    const totalHoursLogged = totalHoursRow.total_hours;

    // 2. Fetch all roadmap phases
    const phaseRows = db
      .prepare('SELECT * FROM roadmap_phases ORDER BY phase_number ASC')
      .all() as PhaseRow[];

    const phases: RoadmapPhase[] = phaseRows.map((p) => {
      // Calculate date window for phase
      const phaseStartDate = addDays(startDateObj, p.start_day - 1);
      const phaseEndDate = addDays(startDateObj, p.end_day - 1);

      const phaseStartStr = formatDate(phaseStartDate);
      const phaseEndStr = formatDate(phaseEndDate);

      // Sum hours logged in this phase window across both users
      const phaseHoursRow = db
        .prepare(
          'SELECT COALESCE(SUM(hours_spent), 0) as phase_hours FROM daily_logs WHERE date >= ? AND date <= ?',
        )
        .get(phaseStartStr, phaseEndStr) as { phase_hours: number };

      const actualHours = phaseHoursRow.phase_hours;

      // Days elapsed inside this specific phase
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

      // Unlocked if current date is within or past phase start date, OR hours recorded
      const isUnlocked = daysElapsedTotal >= p.start_day || actualHours > 0;

      // Completed if actual hours >= target hours OR phase end date has passed
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

export default router;
