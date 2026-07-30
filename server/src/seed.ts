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

console.log('\n🌱 Seeding daily logs for Surya and Gomathi (18 days of data)...\n');

const insertLog = db.prepare(
  'INSERT OR REPLACE INTO daily_logs (user_id, date, topics_studied, hours_spent, notes) VALUES (?, ?, ?, ?, ?)',
);

// ── Extended logs: 18 days to create 3 completed 5-day blocks + current block
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

const gomathiLogs = [
  // Block 1 (days 18-14) — Gomathi wins this block (19.5 vs 16.0)
  { daysAgo: 18, hours: 5.0, topics: 'Python data structures & algorithms', notes: 'Implemented binary search tree.' },
  { daysAgo: 17, hours: 4.0, topics: 'React hooks deep-dive: useReducer & useContext', notes: 'Rebuilt state management from scratch.' },
  { daysAgo: 16, hours: 3.5, topics: 'API design patterns & REST conventions', notes: 'Studied RESTful resource naming.' },
  { daysAgo: 15, hours: 4.0, topics: 'MongoDB aggregation pipeline', notes: 'Complex multi-stage aggregations.' },
  { daysAgo: 14, hours: 3.0, topics: 'Docker containerization basics', notes: 'Created multi-stage Dockerfiles.' },
  // Block 2 (days 13-9) — Surya wins this block (15.5 vs 12.0)
  { daysAgo: 13, hours: 2.0, topics: 'CI/CD pipelines with GitHub Actions', notes: 'Set up automated testing workflow.' },
  { daysAgo: 12, hours: 3.0, topics: 'Frontend testing with Vitest & React Testing Library', notes: 'Wrote component tests.' },
  { daysAgo: 11, hours: 2.5, topics: 'Web accessibility (a11y) audit', notes: 'Fixed keyboard navigation issues.' },
  { daysAgo: 10, hours: 2.5, topics: 'Performance profiling with Lighthouse', notes: 'Optimized largest contentful paint.' },
  { daysAgo: 9, hours: 2.0, topics: 'GraphQL fundamentals & Apollo', notes: 'Built first GraphQL schema.' },
  // Block 3 (days 8-4) — Tie! (16.5 vs 16.5)
  { daysAgo: 8, hours: 3.5, topics: 'State management: Zustand vs Jotai', notes: 'Compared lightweight state libraries.' },
  { daysAgo: 7, hours: 4.0, topics: 'CSS animations & @keyframes mastery', notes: 'Created micro-interaction library.' },
  { daysAgo: 6, hours: 4.0, topics: 'System architecture and API contracts', notes: 'Drafted implementation plan.' },
  { daysAgo: 5, hours: 3.5, topics: 'Frontend UI components design', notes: 'Styled rounded cards and avatars.' },
  { daysAgo: 4, hours: 1.5, topics: 'Code cleanup & documentation', notes: 'Added JSDoc comments.' },
  // Current block (days 3-0)
  { daysAgo: 2, hours: 1.0, topics: 'Code review and refactoring', notes: 'Cleaned up imports.' },
  { daysAgo: 1, hours: 4.5, topics: 'Webhooks and Socket.io realtime broadcasting', notes: 'Set up socket listeners.' },
  { daysAgo: 0, hours: 2.5, topics: 'CSS Grid layouts & Framer Motion transitions', notes: 'Designed contribution calendar component.' },
];

for (const log of gomathiLogs) {
  const dateStr = getDateDaysAgo(log.daysAgo);
  insertLog.run(gomathi.id, dateStr, log.topics, log.hours, log.notes);
  console.log(`  📝 Logged for Gomathi (${dateStr}): ${log.hours} hrs - ${log.topics}`);
}

console.log('\n📊 Block Summary:');
console.log('  Block 1 (days 18-14): Surya 16.0 hrs vs Gomathi 19.5 hrs → 🏆 Gomathi wins!');
console.log('  Block 2 (days 13-9):  Surya 15.5 hrs vs Gomathi 12.0 hrs → 🏆 Surya wins!');
console.log('  Block 3 (days 8-4):   Surya 16.5 hrs vs Gomathi 16.5 hrs → 🤝 Draw!');
console.log('  Block 4 (current):    In progress...\n');

console.log('🎉 Seed complete!\n');
process.exit(0);
