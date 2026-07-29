import { Router } from 'express';
import bcrypt from 'bcrypt';
import { API_ROUTES } from '@streaktrack/shared';
import type { User, LoginResponse } from '@streaktrack/shared';
import db from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

interface DBUserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  profile_picture: string | null;
  bio: string | null;
  join_date: string;
}

// ── POST /api/auth/login ─────────────────────────────────────
router.post(API_ROUTES.AUTH_LOGIN, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const row = db
    .prepare('SELECT id, name, email, password_hash, profile_picture, bio, join_date FROM users WHERE email = ?')
    .get(email) as DBUserRow | undefined;

  if (!row) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const token = signToken({ id: row.id, email: row.email, name: row.name });

  const user: User = {
    id: row.id,
    name: row.name,
    email: row.email,
    profilePicture: row.profile_picture,
    joinDate: row.join_date,
    bio: row.bio || 'Target: Product-based MNC as SDE 🎯',
  };

  const response: LoginResponse = { user, message: 'Login successful' };

  const isProduction = process.env.NODE_ENV === 'production';

  res
    .cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    })
    .json(response);
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post(API_ROUTES.AUTH_LOGOUT, (_req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res
    .clearCookie('token', {
      path: '/',
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    })
    .json({ message: 'Logged out' });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get(API_ROUTES.AUTH_ME, requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, name, email, profile_picture, bio, join_date FROM users WHERE id = ?')
    .get(req.user!.id) as DBUserRow | undefined;

  if (!row) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const user: User = {
    id: row.id,
    name: row.name,
    email: row.email,
    profilePicture: row.profile_picture,
    joinDate: row.join_date,
    bio: row.bio || 'Target: Product-based MNC as SDE 🎯',
  };

  res.json({ user });
});

export default router;
