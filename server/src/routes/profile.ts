import { Router } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { API_ROUTES } from '@streaktrack/shared';
import type { User, ProfileStatsResponse, UpdateProfileRequest } from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { calculateStreakStats } from '../utils/streakCalculator.js';

const router = Router();

// Ensure upload directory exists
const uploadDir = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine for avatar images
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'avatar';
    const ext = extname(file.originalname).toLowerCase() || '.png';
    cb(null, `user_${userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

interface UserRow {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  join_date: string;
}

// ── GET /api/profile/:userId ─────────────────────────────────
router.get(`${API_ROUTES.PROFILE}/:userId`, requireAuth, (req, res) => {
  const userId = parseInt(String(req.params.userId), 10);

  const userRow = db
    .prepare('SELECT id, name, email, profile_picture, bio, github_url, linkedin_url, join_date FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;

  if (!userRow) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const user: User = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    profilePicture: userRow.profile_picture,
    joinDate: userRow.join_date,
    bio: userRow.bio || 'Target: Product-based MNC as SDE 🎯',
    githubUrl: userRow.github_url,
    linkedinUrl: userRow.linkedin_url,
  };

  // Fetch all daily logs to calculate lifetime stats
  const logRows = db
    .prepare(
      'SELECT id, user_id, date, topics_studied, hours_spent, notes, created_at FROM daily_logs WHERE user_id = ? ORDER BY date ASC',
    )
    .all(userId) as {
    id: number;
    user_id: number;
    date: string;
    topics_studied: string;
    hours_spent: number;
    notes: string | null;
    created_at: string;
  }[];

  const logs = logRows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    date: r.date,
    topicsStudied: r.topics_studied,
    hoursSpent: r.hours_spent,
    notes: r.notes,
    createdAt: r.created_at,
  }));

  const streakStats = calculateStreakStats(logs, 180);

  // Count 5-day block milestones won by this user
  const milestonesWonRow = db
    .prepare('SELECT COUNT(*) as count FROM milestones WHERE winner_id = ? AND is_tie = 0')
    .get(userId) as { count: number };

  const response: ProfileStatsResponse = {
    user,
    totalDaysActive: streakStats.totalDaysLogged,
    totalHoursLogged: streakStats.totalHours,
    currentStreak: streakStats.currentStreak,
    longestStreak: streakStats.longestStreak,
    milestonesWon: milestonesWonRow.count,
  };

  res.json(response);
});

// ── PUT /api/profile ─────────────────────────────────────────
router.put(API_ROUTES.PROFILE, requireAuth, (req, res) => {
  const userId = req.user!.id;
  const { bio, name, githubUrl, linkedinUrl } = req.body as UpdateProfileRequest;

  try {
    const current = db
      .prepare('SELECT name, bio, github_url, linkedin_url FROM users WHERE id = ?')
      .get(userId) as { name: string; bio: string | null; github_url: string | null; linkedin_url: string | null };

    const newBio = bio !== undefined ? bio.trim() : current.bio;
    const newName = name !== undefined ? name.trim() : current.name;
    const newGithubUrl = githubUrl !== undefined ? (githubUrl ? githubUrl.trim() : null) : current.github_url;
    const newLinkedinUrl = linkedinUrl !== undefined ? (linkedinUrl ? linkedinUrl.trim() : null) : current.linkedin_url;

    db.prepare('UPDATE users SET bio = ?, name = ?, github_url = ?, linkedin_url = ? WHERE id = ?').run(
      newBio,
      newName,
      newGithubUrl,
      newLinkedinUrl,
      userId,
    );

    const updatedUser = db
      .prepare('SELECT id, name, email, profile_picture, bio, github_url, linkedin_url, join_date FROM users WHERE id = ?')
      .get(userId) as UserRow;

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profile_picture,
        joinDate: updatedUser.join_date,
        bio: updatedUser.bio,
        githubUrl: updatedUser.github_url,
        linkedinUrl: updatedUser.linkedin_url,
      },
    });
  } catch (err: unknown) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// ── POST /api/profile/avatar ─────────────────────────────────
router.post(
  API_ROUTES.UPLOAD_AVATAR,
  requireAuth,
  upload.single('avatar'),
  (req, res) => {
    const userId = req.user!.id;

    if (!req.file) {
      res.status(400).json({ message: 'No image file uploaded' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?').run(
        avatarUrl,
        userId,
      );

      res.json({
        message: 'Avatar updated successfully',
        profilePicture: avatarUrl,
      });
    } catch (err: unknown) {
      console.error('Error updating avatar:', err);
      res.status(500).json({ message: 'Failed to update avatar' });
    }
  },
);

export default router;
