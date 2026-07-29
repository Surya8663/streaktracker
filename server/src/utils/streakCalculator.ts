import type { DailyLog, StreakDay } from '@streaktrack/shared';

function formatDateString(dateObj: Date): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDayDiff(dateStr1: string, dateStr2: string): number {
  const d1 = parseDateString(dateStr1).getTime();
  const d2 = parseDateString(dateStr2).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function calculateStreakStats(logs: DailyLog[], daysCount = 180) {
  const logsByDate = new Map<string, DailyLog>();
  for (const log of logs) {
    logsByDate.set(log.date, log);
  }

  // Get all unique logged dates sorted ascending
  const uniqueLoggedDates = Array.from(logsByDate.keys()).sort();

  // ── Calculate Longest Streak ────────────────────────────────
  let longestStreak = 0;
  let currentRun = 0;
  let prevDate: string | null = null;

  for (const dateStr of uniqueLoggedDates) {
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diff = getDayDiff(prevDate, dateStr);
      if (diff === 1) {
        currentRun += 1;
      } else if (diff > 1) {
        currentRun = 1;
      }
    }
    prevDate = dateStr;
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  // ── Calculate Current Streak ────────────────────────────────
  const todayObj = new Date();
  const todayStr = formatDateString(todayObj);

  const yesterdayObj = new Date(todayObj);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = formatDateString(yesterdayObj);

  let currentStreak = 0;
  let startCheckDate: string | null = null;

  if (logsByDate.has(todayStr)) {
    startCheckDate = todayStr;
  } else if (logsByDate.has(yesterdayStr)) {
    startCheckDate = yesterdayStr;
  }

  if (startCheckDate) {
    let checkDateObj = parseDateString(startCheckDate);
    while (true) {
      const checkStr = formatDateString(checkDateObj);
      if (logsByDate.has(checkStr)) {
        currentStreak += 1;
        checkDateObj.setDate(checkDateObj.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // ── Generate 180-Day Calendar Data ─────────────────────────
  const calendarData: StreakDay[] = [];
  let totalHours = 0;
  let totalDaysLogged = 0;

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(todayObj);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateString(d);

    const log = logsByDate.get(dateStr);
    if (log) {
      totalHours += log.hoursSpent;
      totalDaysLogged += 1;

      let level: 0 | 1 | 2 | 3 = 1;
      if (log.hoursSpent <= 0) {
        level = 0;
      } else if (log.hoursSpent <= 2) {
        level = 1;
      } else if (log.hoursSpent <= 5) {
        level = 2;
      } else {
        level = 3;
      }

      calendarData.push({
        date: dateStr,
        hoursSpent: log.hoursSpent,
        topicsStudied: log.topicsStudied,
        notes: log.notes || null,
        level,
      });
    } else {
      calendarData.push({
        date: dateStr,
        hoursSpent: 0,
        topicsStudied: null,
        notes: null,
        level: 0,
      });
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalHours,
    totalDaysLogged,
    calendarData,
  };
}
