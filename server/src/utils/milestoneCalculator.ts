import db from '../db.js';
import type { Milestone, CurrentBlock, TreatScore } from '@streaktrack/shared';

// ── Date Helpers ─────────────────────────────────────────────
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

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Types for DB rows ────────────────────────────────────────
interface UserRow {
  id: number;
  name: string;
}

interface HoursRow {
  total_hours: number;
}

interface MilestoneRow {
  id: number;
  block_number: number;
  start_date: string;
  end_date: string;
  winner_id: number | null;
  user1_id: number;
  user2_id: number;
  user1_hours: number;
  user2_hours: number;
  is_tie: number;
}

// ── Core Calculator ──────────────────────────────────────────

/**
 * Get the two users (ordered by id ASC).
 * User1 = lower id (Surya), User2 = higher id (Gomathi).
 */
function getUsers(): UserRow[] {
  return db
    .prepare('SELECT id, name FROM users ORDER BY id ASC LIMIT 2')
    .all() as UserRow[];
}

/**
 * Find the earliest log date across both users — this is Day 1.
 */
function getEarliestLogDate(): string | null {
  const row = db
    .prepare('SELECT MIN(date) as earliest FROM daily_logs')
    .get() as { earliest: string | null };
  return row?.earliest || null;
}

/**
 * Sum hours for a user within a date range [startDate, endDate] inclusive.
 */
function sumHoursInRange(userId: number, startDate: string, endDate: string): number {
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(hours_spent), 0) as total_hours FROM daily_logs WHERE user_id = ? AND date >= ? AND date <= ?',
    )
    .get(userId, startDate, endDate) as HoursRow;
  return row.total_hours;
}

/**
 * Compute all milestone blocks from Day 1 to today.
 * Returns { completedBlocks, currentBlock }.
 */
export function computeMilestones(): {
  milestones: Milestone[];
  currentBlock: CurrentBlock | null;
  treatScoreboard: TreatScore[];
  newlyCompleted: Milestone[];
} {
  const users = getUsers();
  if (users.length < 2) {
    return { milestones: [], currentBlock: null, treatScoreboard: [], newlyCompleted: [] };
  }

  const [user1, user2] = users;
  const earliestDate = getEarliestLogDate();

  if (!earliestDate) {
    return { milestones: [], currentBlock: null, treatScoreboard: [], newlyCompleted: [] };
  }

  const startAnchor = parseDate(earliestDate);
  const today = new Date();
  const todayStr = formatDate(today);

  // Generate all 5-day blocks from anchor
  const blocks: { blockNumber: number; startDate: string; endDate: string }[] = [];
  let blockStart = new Date(startAnchor);
  let blockNum = 1;

  while (formatDate(blockStart) <= todayStr) {
    const blockEnd = addDays(blockStart, 4); // 5-day block (inclusive)
    blocks.push({
      blockNumber: blockNum,
      startDate: formatDate(blockStart),
      endDate: formatDate(blockEnd),
    });
    blockStart = addDays(blockEnd, 1); // Next block starts day after
    blockNum++;
  }

  // Separate completed vs in-progress blocks
  const completedBlocks = blocks.filter((b) => b.endDate < todayStr);
  const inProgressBlock = blocks.find((b) => b.startDate <= todayStr && b.endDate >= todayStr) || null;

  // Upsert completed blocks into milestones table and track newly inserted ones
  const newlyCompleted: Milestone[] = [];

  const upsertStmt = db.prepare(`
    INSERT INTO milestones (block_number, start_date, end_date, winner_id, user1_id, user2_id, user1_hours, user2_hours, is_tie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(block_number) DO UPDATE SET
      winner_id = excluded.winner_id,
      user1_hours = excluded.user1_hours,
      user2_hours = excluded.user2_hours,
      is_tie = excluded.is_tie
  `);

  const existingBlocks = new Set<number>();
  const existingRows = db
    .prepare('SELECT block_number FROM milestones')
    .all() as { block_number: number }[];
  for (const row of existingRows) {
    existingBlocks.add(row.block_number);
  }

  for (const block of completedBlocks) {
    const u1Hours = sumHoursInRange(user1.id, block.startDate, block.endDate);
    const u2Hours = sumHoursInRange(user2.id, block.startDate, block.endDate);

    const isTie = Math.abs(u1Hours - u2Hours) < 0.01;
    const winnerId = isTie ? null : u1Hours > u2Hours ? user1.id : user2.id;

    const isNew = !existingBlocks.has(block.blockNumber);

    upsertStmt.run(
      block.blockNumber,
      block.startDate,
      block.endDate,
      winnerId,
      user1.id,
      user2.id,
      u1Hours,
      u2Hours,
      isTie ? 1 : 0,
    );

    if (isNew) {
      const loserId = isTie ? null : winnerId === user1.id ? user2.id : user1.id;
      const winnerName = isTie ? null : winnerId === user1.id ? user1.name : user2.name;
      const loserName = isTie ? null : loserId === user1.id ? user1.name : user2.name;

      newlyCompleted.push({
        id: 0, // Will be populated from DB below
        blockNumber: block.blockNumber,
        startDate: block.startDate,
        endDate: block.endDate,
        winnerId,
        winnerName,
        loserId,
        loserName,
        user1Hours: u1Hours,
        user2Hours: u2Hours,
        user1Id: user1.id,
        user2Id: user2.id,
        user1Name: user1.name,
        user2Name: user2.name,
        isTie,
      });
    }
  }

  // Read all milestones from DB (now up to date)
  const milestoneRows = db
    .prepare('SELECT * FROM milestones ORDER BY block_number ASC')
    .all() as MilestoneRow[];

  const milestones: Milestone[] = milestoneRows.map((row) => {
    const winnerId = row.winner_id;
    const isTie = row.is_tie === 1;
    const loserId = isTie ? null : winnerId === user1.id ? user2.id : user1.id;
    const winnerName = isTie ? null : winnerId === user1.id ? user1.name : user2.name;
    const loserName = isTie ? null : loserId === user1.id ? user1.name : user2.name;

    return {
      id: row.id,
      blockNumber: row.block_number,
      startDate: row.start_date,
      endDate: row.end_date,
      winnerId,
      winnerName,
      loserId,
      loserName,
      user1Hours: row.user1_hours,
      user2Hours: row.user2_hours,
      user1Id: row.user1_id,
      user2Id: row.user2_id,
      user1Name: user1.name,
      user2Name: user2.name,
      isTie,
    };
  });

  // Update newly completed milestone IDs from DB
  for (const nc of newlyCompleted) {
    const dbRow = milestones.find((m) => m.blockNumber === nc.blockNumber);
    if (dbRow) nc.id = dbRow.id;
  }

  // Current in-progress block
  let currentBlock: CurrentBlock | null = null;
  if (inProgressBlock) {
    const u1Hours = sumHoursInRange(user1.id, inProgressBlock.startDate, inProgressBlock.endDate);
    const u2Hours = sumHoursInRange(user2.id, inProgressBlock.startDate, inProgressBlock.endDate);
    const endDate = parseDate(inProgressBlock.endDate);
    const daysRemaining = Math.max(0, dayDiff(today, endDate));
    const startDate = parseDate(inProgressBlock.startDate);
    const daysElapsed = Math.min(5, dayDiff(startDate, today) + 1);

    currentBlock = {
      blockNumber: inProgressBlock.blockNumber,
      startDate: inProgressBlock.startDate,
      endDate: inProgressBlock.endDate,
      user1Id: user1.id,
      user2Id: user2.id,
      user1Name: user1.name,
      user2Name: user2.name,
      user1Hours: u1Hours,
      user2Hours: u2Hours,
      daysRemaining,
      daysElapsed,
    };
  }

  // Treat scoreboard: count how many blocks each user lost
  const treatScoreboard: TreatScore[] = [
    {
      userId: user1.id,
      userName: user1.name,
      treatsOwed: milestones.filter((m) => !m.isTie && m.winnerId !== user1.id).length,
    },
    {
      userId: user2.id,
      userName: user2.name,
      treatsOwed: milestones.filter((m) => !m.isTie && m.winnerId !== user2.id).length,
    },
  ];

  return { milestones, currentBlock, treatScoreboard, newlyCompleted };
}
