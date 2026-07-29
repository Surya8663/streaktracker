import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import DatabaseConstructor from 'better-sqlite3';
import type { Database } from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/streaktrack.db';

// Ensure the data directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db: Database = new DatabaseConstructor(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ── Schema initialization ────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    profile_picture TEXT,
    bio TEXT DEFAULT 'Target: Product-based MNC as SDE 🎯',
    join_date TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    topics_studied TEXT NOT NULL,
    hours_spent REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_number INTEGER NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    winner_id INTEGER,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    user1_hours REAL NOT NULL DEFAULT 0,
    user2_hours REAL NOT NULL DEFAULT 0,
    is_tie INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (winner_id) REFERENCES users(id),
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS roadmap_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    start_day INTEGER NOT NULL,
    end_day INTEGER NOT NULL,
    target_hours REAL NOT NULL,
    icon TEXT NOT NULL DEFAULT '🚀'
  );
`);

// Seed default 6-month roadmap phases if empty
const count = (db.prepare('SELECT COUNT(*) as count FROM roadmap_phases').get() as { count: number }).count;
if (count === 0) {
  const insertPhase = db.prepare(
    'INSERT INTO roadmap_phases (phase_number, title, subtitle, start_day, end_day, target_hours, icon) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  insertPhase.run(1, 'DSA & Core CS Fundamentals', 'Month 1: Arrays, Strings, Trees & OOPs basics', 1, 30, 80, '🧩');
  insertPhase.run(2, 'Advanced Algorithms & DP', 'Month 2: Dynamic Programming, Graphs & Trie', 31, 60, 100, '⚡');
  insertPhase.run(3, 'Projects & System Design', 'Month 3-4: Full-Stack Apps, LLD & Scalability', 61, 120, 150, '🛠️');
  insertPhase.run(4, 'Mock Interviews & Speed Coding', 'Month 5: Live Peer Mocks & LeetCode Timed Contests', 121, 150, 100, '🗣️');
  insertPhase.run(5, 'Applications & Placement Push', 'Month 6: Resume Polish, Off-Campus Referrals & HR Prep', 151, 180, 80, '🔥');
}

// Ensure bio column exists for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT 'Target: Product-based MNC as SDE 🎯'");
} catch {
  // Column already exists
}

console.log(`[db] SQLite connected: ${DB_PATH}`);

export default db;
