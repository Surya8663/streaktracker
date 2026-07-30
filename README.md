# 🎯 StreakTrack

A full-stack habit & study streak tracking application designed for pair accountability between two learners (Surya & Gomathi).

---

## 🚀 Features

- **Auth**: JWT httpOnly cookie authentication for Surya & Gomathi.
- **Daily Logs**: Log & edit daily study topics, hours spent, and optional reflections.
- **Streak Heatmap**: 180-day GitHub-style contribution grid with 4 intensity levels, tooltips, and current/longest streak stats.
- **Real-Time Presence & Socket.io**: Live presence dots (🟢/⚪), realtime log updates, and toast notifications without page reloads.
- **5-Day Block Milestones & Treats**: Competitions comparing total hours every 5 days, crowning winners with confetti bursts (`canvas-confetti`) and tracking treat debts (🍫 *"You owe Surya a treat!"*).
- **6-Month Placement Roadmap**: Interactive horizontal timeline with animated progress filling, 5 customizable phase nodes, countdown to placement season, and a **`🎯 MNC Offer`** end-goal marker.
- **User Profiles**: Custom avatar photo upload (via `multer`), lifetime stats summary, and editable placement goal statements.
- **UI Polish**: Light theme (`stone-50`), teal/emerald accents, Framer Motion page transitions, and count-up animated numbers (`AnimatedCounter`).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS v4, Framer Motion, Socket.io Client
- **Backend**: Node.js, Express, Socket.io, SQLite (`better-sqlite3`), Multer
- **Shared**: `@streaktrack/shared` workspace for common types & constants

---

## 💻 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
Performs a clean state reset for both Surya & Gomathi, initializing both accounts at **Day 0** with 0 streak and 0 logs:
```bash
npm run seed -w server
```

### 3. Run Development Servers
```bash
# Start backend server (port 3001)
npm run dev:server

# Start client frontend (port 5173)
npm run dev:client
```

Open `http://localhost:5173` in your browser.

#### Demo User Credentials:
- **Surya**: `surya@streaktrack.app` / `surya123`
- **Gomathi**: `gomathi@streaktrack.app` / `gomathi123`

---

## 🌐 Production Cloud Deployment Guide

### Option 1: Frontend on Vercel + Backend on Render

#### Step A: Deploy Backend to Render
1. Push your repository to GitHub.
2. Sign in to [Render.com](https://render.com) and click **New > Web Service**.
3. Connect your GitHub repo and select the `/server` directory (or use `render.yaml`).
4. Set Environment Variables on Render:
   - `NODE_ENV`: `production`
   - `PORT`: `3001`
   - `JWT_SECRET`: *(Generate a random 32-character secret)*
   - `CLIENT_URL`: `https://your-app.vercel.app`
5. Render will automatically set `RENDER_EXTERNAL_URL`, which activates the 14-minute self-keepalive ping so the server stays awake!

#### Step B: Deploy Frontend to Vercel
1. Sign in to [Vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your repository, set Root Directory to `client`.
3. Set Environment Variables on Vercel:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
   - `VITE_WS_URL`: `https://your-backend.onrender.com`
4. Click **Deploy**. Vercel uses `client/vercel.json` for SPA route rewriting.

---

### Option 2: Deploy Backend with Docker on Railway
1. Sign in to [Railway.app](https://railway.app).
2. Create a new project from your GitHub repository.
3. Railway will automatically detect `server/Dockerfile`.
4. Add environment variables (`JWT_SECRET`, `CLIENT_URL`, `PORT=3001`).

---

## 📁 Repository Structure

```
├── client/              # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/  # Avatar, StreakCalendar, DailyLogForm, TreatBadge, AnimatedCounter
│   │   ├── context/     # AuthContext, SocketContext
│   │   └── pages/       # HomePage, ComparisonDashboardPage, MilestonesPage, RoadmapPage, ProfilePage
│   ├── vercel.json      # Vercel SPA rewrite config
│   └── netlify.toml     # Netlify SPA redirect config
├── server/              # Express + Socket.io backend
│   ├── src/
│   │   ├── middleware/  # Auth & JWT verification
│   │   ├── routes/      # Auth, Logs, Streaks, Milestones, Roadmap, Profile
│   │   └── utils/       # Streak & Milestone calculators
│   ├── Dockerfile       # Multi-stage production container build
│   └── data/            # SQLite database storage
├── shared/              # Shared TypeScript types & constants
├── render.yaml          # Render Infrastructure-as-Code blueprint
└── package.json         # Workspace root configuration
```
