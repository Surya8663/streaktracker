import 'dotenv/config';
import bcrypt from 'bcrypt';
import db from './db.js';

const SALT_ROUNDS = 10;

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const users = [
  {
    name: 'Surya',
    email: 'surya@streaktrack.app',
    password: 'surya123',
    profile_picture: '/avatars/surya.jpg',
    github_url: 'https://github.com/Surya8663',
    linkedin_url: 'https://www.linkedin.com/in/g-surya-63a01b290/',
  },
  {
    name: 'Gomathi',
    email: 'gomathi@streaktrack.app',
    password: 'gomathi123',
    profile_picture: '/avatars/gomathi.jpg',
    github_url: 'https://github.com/gopika-repo',
    linkedin_url: 'https://www.linkedin.com/in/gomathi-dhandapani-47435b350/',
  },
];

console.log('\n🌱 Seeding users and updating social profiles...\n');

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (name, email, password_hash, profile_picture, github_url, linkedin_url) VALUES (?, ?, ?, ?, ?, ?)',
);

const updateUserSocials = db.prepare(
  'UPDATE users SET profile_picture = ?, github_url = ?, linkedin_url = ? WHERE email = ?',
);

for (const user of users) {
  const hash = bcrypt.hashSync(user.password, SALT_ROUNDS);
  const result = insertUser.run(user.name, user.email, hash, user.profile_picture, user.github_url, user.linkedin_url);

  if (result.changes > 0) {
    console.log(`  ✅ Created: ${user.name} <${user.email}>`);
  } else {
    updateUserSocials.run(user.profile_picture, user.github_url, user.linkedin_url, user.email);
    console.log(`  🔄 Updated: ${user.name} <${user.email}> GitHub/LinkedIn links set.`);
  }
}

// Fetch user IDs
const surya = db.prepare('SELECT id FROM users WHERE email = ?').get('surya@streaktrack.app') as { id: number };
const gomathi = db.prepare('SELECT id FROM users WHERE email = ?').get('gomathi@streaktrack.app') as { id: number };

// Clear old logs and milestones so seed is idempotent
db.prepare('DELETE FROM daily_logs').run();
db.prepare('DELETE FROM milestones').run();

console.log('\n🌱 Seeding daily logs for Surya (Gomathi remains at Day 0)...\n');

const insertLog = db.prepare(
  'INSERT OR REPLACE INTO daily_logs (user_id, date, topics_studied, hours_spent, notes) VALUES (?, ?, ?, ?, ?)',
);

const suryaLogs = [
  // Block 1 (days 18-14)
  { daysAgo: 18, hours: 3.0, topics: 'JavaScript fundamentals & closures', notes: 'Reviewed scope chain and closures deeply.' },
  { daysAgo: 17, hours: 2.5, topics: 'TypeScript generics & utility types', notes: 'Practiced with Partial, Pick, Omit.' },
  { daysAgo: 16, hours: 4.0, topics: 'React component patterns & composition', notes: 'Built reusable compound components.' },
  { daysAgo: 15, hours: 1.5, topics: 'CSS Grid & Flexbox deep-dive', notes: 'Completed grid layout challenges.' },
  { daysAgo: 14, hours: 5.0, topics: 'Node.js event loop & async patterns', notes: 'Studied libuv and microtask queue.' },
  // Block 2 (days 13-9)
  { daysAgo: 13, hours: 3.5, topics: 'Express middleware architecture', notes: 'Built custom error-handling middleware.' },
  { daysAgo: 12, hours: 6.0, topics: 'Database design & SQLite optimization', notes: 'Learned WAL mode and indexing strategies.' },
  { daysAgo: 11, hours: 2.0, topics: 'JWT auth & security best practices', notes: 'Implemented httpOnly cookie auth flow.' },
  { daysAgo: 10, hours: 3.0, topics: 'Full-stack debugging techniques', notes: 'Chrome DevTools network analysis.' },
  { daysAgo: 9, hours: 1.0, topics: 'ESLint v9 flat config & Prettier', notes: 'Configured monorepo linting rules.' },
  // Block 3 (days 8-4)
  { daysAgo: 8, hours: 4.5, topics: 'Socket.io real-time architecture', notes: 'Set up bi-directional event system.' },
  { daysAgo: 7, hours: 3.0, topics: 'Framer Motion advanced animations', notes: 'Learned AnimatePresence and layout animations.' },
  { daysAgo: 6, hours: 5.5, topics: 'Full-stack project scaffolding', notes: 'Initialized Vite + Express monorepo.' },
  { daysAgo: 5, hours: 2.0, topics: 'TailwindCSS v4 configuration', notes: 'Customized pastel theme colors.' },
  { daysAgo: 4, hours: 1.5, topics: 'Code review & refactoring session', notes: 'Cleaned up type imports.' },
  // Current block (days 3-0)
  { daysAgo: 3, hours: 1.5, topics: 'ESLint v9 flat config setup', notes: 'Fixed linting rules.' },
  { daysAgo: 2, hours: 6.0, topics: 'Express REST API & JWT authentication', notes: 'Implemented httpOnly cookies.' },
  { daysAgo: 1, hours: 3.0, topics: 'TypeScript 5.6 strict mode & generics', notes: 'Worked on shared type definitions.' },
  { daysAgo: 0, hours: 4.0, topics: 'React 19, Socket.io events, SQLite WAL mode', notes: 'Built full Daily Log feature with custom animations and validations!' },
];

for (const log of suryaLogs) {
  const dateStr = getDateDaysAgo(log.daysAgo);
  insertLog.run(surya.id, dateStr, log.topics, log.hours, log.notes);
  console.log(`  📝 Logged for Surya (${dateStr}): ${log.hours} hrs - ${log.topics}`);
}

// Reset Gomathi's profile state to Day 0
db.prepare(`
  INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
  VALUES (?, 'not_started', 0, NULL, NULL)
  ON CONFLICT(user_id) DO UPDATE SET
    status = 'not_started',
    current_day = 0,
    start_date = NULL,
    completion_date = NULL
`).run(gomathi.id);

db.prepare('DELETE FROM user_roadmap_tasks WHERE user_id = ?').run(gomathi.id);
db.prepare('DELETE FROM daily_roadmap_sessions WHERE user_id = ?').run(gomathi.id);

console.log('\n📊 Gomathi Status: Day 0 (0 logs, 0 streak, 0 completed tasks)');
console.log('🎉 Seed complete!\n');
process.exit(0);
