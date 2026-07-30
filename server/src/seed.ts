import 'dotenv/config';
import bcrypt from 'bcrypt';
import db from './db.js';

const SALT_ROUNDS = 10;

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

console.log('\n🌱 Seeding user accounts & social profiles...\n');

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
    console.log(`  ✅ Created user: ${user.name} <${user.email}>`);
  } else {
    updateUserSocials.run(user.profile_picture, user.github_url, user.linkedin_url, user.email);
    console.log(`  🔄 Updated socials: ${user.name} <${user.email}>`);
  }
}

// Fetch user IDs
const surya = db.prepare('SELECT id FROM users WHERE email = ?').get('surya@streaktrack.app') as { id: number };
const gomathi = db.prepare('SELECT id FROM users WHERE email = ?').get('gomathi@streaktrack.app') as { id: number };

console.log('\n🧹 Cleaning demo logs, milestones & roadmap sessions for fresh Day 0 start...\n');

// Perform clean reset of logs, milestones, sessions & progress
db.prepare('DELETE FROM daily_logs').run();
db.prepare('DELETE FROM milestones').run();
db.prepare('DELETE FROM daily_roadmap_sessions').run();
db.prepare('DELETE FROM user_roadmap_tasks').run();

// Reset both users' roadmap profiles to Day 0 (not_started)
const resetProfile = db.prepare(`
  INSERT INTO user_roadmap_profiles (user_id, status, current_day, start_date, completion_date)
  VALUES (?, 'not_started', 0, NULL, NULL)
  ON CONFLICT(user_id) DO UPDATE SET
    status = 'not_started',
    current_day = 0,
    start_date = NULL,
    completion_date = NULL
`);

resetProfile.run(surya.id);
resetProfile.run(gomathi.id);

console.log('  ✅ Surya status: Day 0 (0 logs, 0 streak, 0 sessions)');
console.log('  ✅ Gomathi status: Day 0 (0 logs, 0 streak, 0 sessions)');
console.log('\n🎉 Fresh seed complete! Both users start at Day 0.\n');
process.exit(0);
