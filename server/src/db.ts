import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import DatabaseConstructor from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import bcrypt from 'bcrypt';

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
    github_url TEXT,
    linkedin_url TEXT,
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

  /* ── Month 1 AI Engineer Roadmap Tables ── */
  CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS roadmap_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_number INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    recommended_minutes INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_day ON roadmap_tasks(day_number);
  CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_category ON roadmap_tasks(category);
  CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_week ON roadmap_tasks(week_number);

  CREATE TABLE IF NOT EXISTS user_roadmap_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES roadmap_tasks(id),
    UNIQUE(user_id, task_id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_roadmap_tasks_user_status ON user_roadmap_tasks(user_id, is_completed);

  CREATE TABLE IF NOT EXISTS user_roadmap_profiles (
    user_id INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'not_started',
    current_day INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    completion_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS daily_roadmap_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    minutes_studied INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_roadmap_sessions_user_date ON daily_roadmap_sessions(user_id, date);

  CREATE TABLE IF NOT EXISTS roadmap_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category, name)
  );

  CREATE INDEX IF NOT EXISTS idx_roadmap_sources_cat ON roadmap_sources(category);

  CREATE TABLE IF NOT EXISTS roadmap_source_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT,
    added_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES roadmap_sources(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_roadmap_source_links_source ON roadmap_source_links(source_id);

  CREATE TABLE IF NOT EXISTS roadmap_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_roadmap_chat_created ON roadmap_chat_messages(created_at);
`);

// Ensure bio, github_url, linkedin_url columns exist for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT 'Target: Product-based MNC as SDE 🎯'");
} catch {
  // Column already exists
}

try {
  db.exec('ALTER TABLE users ADD COLUMN github_url TEXT');
} catch {
  // Column already exists
}

try {
  db.exec('ALTER TABLE users ADD COLUMN linkedin_url TEXT');
} catch {
  // Column already exists
}

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

// Seed default users if users table is empty
const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
if (userCount === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, profile_picture, bio, github_url, linkedin_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const suryaHash = bcrypt.hashSync('surya123', 10);
  const gomathiHash = bcrypt.hashSync('gomathi123', 10);
  insertUser.run(
    'Surya',
    'surya@streaktrack.app',
    suryaHash,
    '/avatars/surya.jpg',
    'Target: Product-based MNC as SDE 🎯',
    'https://github.com/Surya8663',
    'https://www.linkedin.com/in/g-surya-63a01b290/',
  );
  insertUser.run(
    'Gomathi',
    'gomathi@streaktrack.app',
    gomathiHash,
    '/avatars/gomathi.jpg',
    'Target: Product-based MNC as SDE 🎯',
    'https://github.com/gopika-repo',
    'https://www.linkedin.com/in/gomathi-dhandapani-47435b350/',
  );
  console.log('[db] Auto-seeded default users: Surya & Gomathi');
}

// ── Auto-seed 12 default study sources across 5 categories ──────────────
const sourceCount = (db.prepare('SELECT COUNT(*) as count FROM roadmap_sources').get() as { count: number }).count;
if (sourceCount === 0) {
  const insertSource = db.prepare('INSERT INTO roadmap_sources (category, name, sort_order) VALUES (?, ?, ?)');

  const defaultSources: { category: string; name: string; sortOrder: number }[] = [
    { category: 'DSA', name: 'Striver / takeUforward', sortOrder: 1 },
    { category: 'DSA', name: 'Abdul Bari', sortOrder: 2 },
    { category: 'LeetCode', name: 'NeetCode', sortOrder: 1 },
    { category: 'Python', name: 'freeCodeCamp Python Full Course', sortOrder: 1 },
    { category: 'Python', name: 'Corey Schafer', sortOrder: 2 },
    { category: 'System Design', name: 'Gaurav Sen', sortOrder: 1 },
    { category: 'System Design', name: 'ByteByteGo / Alex Xu', sortOrder: 2 },
    { category: 'System Design', name: 'Tech Dummies / Narendra L', sortOrder: 3 },
    { category: 'AI Engineer', name: '3Blue1Brown', sortOrder: 1 },
    { category: 'AI Engineer', name: 'StatQuest with Josh Starmer', sortOrder: 2 },
    { category: 'AI Engineer', name: 'Krish Naik / CampusX', sortOrder: 3 },
    { category: 'AI Engineer', name: 'Andrej Karpathy', sortOrder: 4 },
  ];

  for (const s of defaultSources) {
    insertSource.run(s.category, s.name, s.sortOrder);
  }
  console.log('[db] Auto-seeded 12 default study sources across 5 categories');
}

// ── Auto-seed Month 1 AI Engineer Roadmap tasks if table is empty ──────
interface ParsedTask {
  dayNumber: number;
  weekNumber: number;
  title: string;
  category: string;
  recommendedMinutes: number;
  sortOrder: number;
}

function parseRoadmapMarkdown(markdownPath: string): ParsedTask[] {
  if (!existsSync(markdownPath)) {
    console.warn(`[db] Markdown file not found at ${markdownPath}`);
    return [];
  }

  const content = readFileSync(markdownPath, 'utf-8');
  const lines = content.split('\n');
  const tasks: ParsedTask[] = [];

  let currentDay = 0;
  let currentWeek = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Match header: ### Day 1 — Week 1
    const dayMatch = trimmed.match(/^###\s+Day\s+(\d+)(?:\s*[\u2014\-]\s*Week\s+(\d+))?/i);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1], 10);
      currentWeek = dayMatch[2] ? parseInt(dayMatch[2], 10) : Math.ceil(currentDay / 7);
      continue;
    }

    // Match task bullet: - **[Category]** Title | 45 mins | Sort: 1
    const taskMatch = trimmed.match(/^[-*]\s+\*\*\[(.*?)\]\*\*\s+(.*?)\s*\|\s*(\d+)\s*mins\s*\|\s*Sort:\s*(\d+)/i);
    if (taskMatch && currentDay > 0) {
      const category = taskMatch[1].trim();
      const title = taskMatch[2].trim();
      const recommendedMinutes = parseInt(taskMatch[3], 10);
      const sortOrder = parseInt(taskMatch[4], 10);

      tasks.push({
        dayNumber: currentDay,
        weekNumber: currentWeek || Math.ceil(currentDay / 7),
        title,
        category,
        recommendedMinutes,
        sortOrder,
      });
    }
  }

  return tasks;
}

const taskCount = (db.prepare('SELECT COUNT(*) as count FROM roadmap_tasks').get() as { count: number }).count;
if (taskCount === 0) {
  const possiblePaths = [
    join(process.cwd(), 'docs', 'month1-ai-engineer-roadmap.md'),
    join(process.cwd(), '..', 'docs', 'month1-ai-engineer-roadmap.md'),
  ];

  let markdownPath = possiblePaths.find((p) => existsSync(p)) || possiblePaths[0];
  const parsedTasks = parseRoadmapMarkdown(markdownPath);

  if (parsedTasks.length > 0) {
    const insertTask = db.prepare(
      'INSERT INTO roadmap_tasks (day_number, week_number, title, category, recommended_minutes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    );

    const insertMany = db.transaction((tasks: ParsedTask[]) => {
      for (const t of tasks) {
        insertTask.run(t.dayNumber, t.weekNumber, t.title, t.category, t.recommendedMinutes, t.sortOrder);
      }
    });

    insertMany(parsedTasks);
    console.log(`[db] Auto-seeded ${parsedTasks.length} Month 1 AI Engineer roadmap tasks from ${markdownPath}`);
  } else {
    console.warn('[db] No tasks parsed from markdown to seed roadmap_tasks.');
  }
}

// ── One-time migration: Reset Gomathi to Day 0 ──────────────────────────
const resetMigrationName = 'gomathi_reset_day0_v1';
const migrationExecuted = db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(resetMigrationName);

if (!migrationExecuted) {
  const gomathiUser = db.prepare('SELECT id FROM users WHERE email = ?').get('gomathi@streaktrack.app') as { id: number } | undefined;
  if (gomathiUser) {
    const runReset = db.transaction((userId: number) => {
      db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_roadmap_tasks WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM daily_roadmap_sessions WHERE user_id = ?').run(userId);
      db.prepare(`
        INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
        VALUES (?, 'not_started', 0, NULL, NULL)
        ON CONFLICT(user_id) DO UPDATE SET
          status = 'not_started',
          current_day = 0,
          start_date = NULL,
          completion_date = NULL
      `).run(userId);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(resetMigrationName);
    });

    runReset(gomathiUser.id);
    console.log('[db/migration] Applied gomathi_reset_day0_v1: Reset Gomathi to Day 0, 0 tasks, 0 hours, 0 streak.');
  }
}

// Ensure default user roadmap profiles exist
const suryaUser = db.prepare('SELECT id FROM users WHERE email = ?').get('surya@streaktrack.app') as { id: number } | undefined;
if (suryaUser) {
  db.prepare(`
    INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
    VALUES (?, 'active', 1, ?, NULL)
    ON CONFLICT(user_id) DO NOTHING
  `).run(suryaUser.id, new Date().toISOString().split('T')[0]);
}

const gomathiUser = db.prepare('SELECT id FROM users WHERE email = ?').get('gomathi@streaktrack.app') as { id: number } | undefined;
if (gomathiUser) {
  db.prepare(`
    INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
    VALUES (?, 'not_started', 0, NULL, NULL)
    ON CONFLICT(user_id) DO NOTHING
  `).run(gomathiUser.id);
}

console.log(`[db] SQLite connected: ${DB_PATH}`);

export default db;
