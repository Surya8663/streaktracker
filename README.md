# 🎯 StreakTrack

A full-stack habit, study streak tracking, and **AI Engineer Placement Roadmap Command Centre** designed for pair accountability between two study partners (**Surya & Gomathi**).

---

## 🚀 Features & Highlights

- **🔑 Pair Authentication**: Secure JWT httpOnly cookie auth with GitHub and LinkedIn social profile integration for Surya & Gomathi.
- **⚡ Today's Mission Card**: Interactive roadmap-driven dashboard card displaying current day & week tasks (DSA, LeetCode, Python, System Design, AI Engineer), session minute logging, reflection notes, and auto-sync to the Streak Calendar.
- **🗺️ AI Engineer Roadmap Command Centre**:
  - **Dark Cosmic UI**: Dark slate/navy theme (`bg-slate-950`), glowing gradient orbs, subtle grid, 3D hover-tilt cards (`useReducedMotion` supported), and `react-hot-toast` notifications.
  - **Side-by-Side Surya & Gomathi Progress**: Real-time progress cards comparing `% complete`, `current day`, `completed tasks`, and `hours studied`.
  - **30-Day Journey Grid**: Filterable by week (`All Weeks`, `Week 1`–`5`), featuring current active day ring, saved day flame 🔥, and future day lock indicator 🔒.
  - **Interactive Day Modal**: Full task checklist grouped by category + study session logging form.
  - **Task CRUD**: Shared curriculum editing for both users without affecting individual user completion states.
- **📚 Shared Resource Vault**: Preloaded with 12 top educators (Striver, Abdul Bari, NeetCode, Corey Schafer, Gaurav Sen, ByteByteGo, 3Blue1Brown, StatQuest, Andrej Karpathy, etc.) across 5 categories with unlimited link storage, strict `http/https` URL validation, and contributor avatars.
- **💬 Real-Time Pair Study Chat**: SQLite-persisted chat stream with multiline support (`Enter` sends, `Shift+Enter` new line), 1500-character limit, real-time `chat:message` Socket.io events, message deduplication, and presence indicator (🟢 Online / ⚪ Offline).
- **🔥 Heatmap & Milestones**: 180-day GitHub-style contribution grid, 5-day block milestone competitions with confetti celebrations (`canvas-confetti`), and treat debt tracker (🍫 *"You owe Surya a treat!"*).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS v4, Framer Motion, Socket.io Client, react-hot-toast
- **Backend**: Node.js, Express, Socket.io, SQLite (`better-sqlite3`), Multer, bcrypt
- **Shared**: `@streaktrack/shared` workspace package for unified TypeScript types & constants

---

## 💻 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Clean Seed Database
Resets database state so both **Surya** and **Gomathi** start fresh at **Day 0** (`status: 'not_started'`, 0 streak, 0 logs, 0 hours):
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

## 📡 API Reference Overview

| Module | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Authenticate user and set JWT httpOnly cookie |
| **Auth** | `/api/auth/me` | `GET` | Get current authenticated user profile |
| **Auth** | `/api/auth/logout` | `POST` | Clear auth cookie |
| **Logs** | `/api/logs` | `POST` | Log daily study topics & hours (Asia/Kolkata date) |
| **Logs** | `/api/logs/:userId` | `GET` | Fetch daily study logs for user (partner readable) |
| **Roadmap** | `/api/roadmap/month1` | `GET` | Get Month 1 curriculum, 30 days, tasks, and both users' progress |
| **Roadmap** | `/api/roadmap/month1/start` | `POST` | Start signed-in user's roadmap at Day 1 |
| **Roadmap** | `/api/roadmap/tasks` | `POST` | Create a shared task across both roadmaps |
| **Roadmap** | `/api/roadmap/tasks/:id/progress` | `PATCH` | Check/uncheck task for signed-in user |
| **Roadmap** | `/api/roadmap/month1/days/:day/save` | `POST` | Log minutes & notes, sync to daily logs & advance day |
| **Sources** | `/api/roadmap/sources` | `GET` | Get all shared study sources & links grouped by category |
| **Sources** | `/api/roadmap/sources` | `POST` | Add a new source group / educator name |
| **Sources** | `/api/roadmap/sources/:id/links` | `POST` | Add a URL link with http/https validation |
| **Chat** | `/api/roadmap/chat` | `GET` | Fetch recent 100 chat messages |
| **Chat** | `/api/roadmap/chat` | `POST` | Send a new chat message (max 1500 chars) |

---

## 🔐 Environment Variables

| Variable | Scope | Default / Example | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server | `development` / `production` | Node execution environment |
| `PORT` | Server | `3001` | Backend HTTP & WebSocket port |
| `JWT_SECRET` | Server | `super-secret-key-32-chars` | Secret key for signing JWT tokens |
| `CLIENT_URL` | Server | `http://localhost:5173` | Allowed CORS origin for client requests |
| `VITE_API_URL` | Client | `http://localhost:3001` | Express REST API base URL |
| `VITE_WS_URL` | Client | `http://localhost:3001` | Socket.io WebSocket server URL |

---

## 🌐 Production Cloud Deployment Guide

### Option 1: Frontend on Vercel + Backend on Render

#### Step A: Deploy Backend to Render
1. Sign in to [Render.com](https://render.com) and create a **Web Service**.
2. Connect your GitHub repository and set root directory to `/server`.
3. Build Command: `npm run build -w shared && npm run build -w server`
4. Start Command: `node server/dist/index.js`
5. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `3001`
   - `JWT_SECRET`: *(Generate a secure 32-character secret)*
   - `CLIENT_URL`: `https://your-app.vercel.app`

#### Step B: Deploy Frontend to Vercel
1. Sign in to [Vercel.com](https://vercel.com) and import the repository.
2. Set Root Directory to `client`.
3. Framework Preset: `Vite`
4. Environment Variables:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
   - `VITE_WS_URL`: `https://your-backend.onrender.com`

---

## 📁 Repository Structure

```
├── client/              # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/  # Avatar, TodaysMissionCard, StreakCalendar, TreatBadge
│   │   ├── context/     # AuthContext, SocketContext
│   │   └── pages/       # HomePage, ComparisonDashboardPage, RoadmapPage, MilestonesPage, ProfilePage
│   ├── vercel.json      # Vercel SPA rewrite config
├── server/              # Express + Socket.io backend
│   ├── src/
│   │   ├── middleware/  # Auth & JWT verification
│   │   ├── routes/      # Auth, Logs, Roadmap, Sources, Chat, Streaks, Milestones
│   │   └── db.ts        # SQLite table definitions & auto-seeding engine
│   ├── seed.ts          # Clean Day 0 reset script
│   └── data/            # SQLite database storage (streaktrack.db)
├── shared/              # Shared TypeScript types, constants & contracts (@streaktrack/shared)
├── docs/                # Month 1 AI Engineer Roadmap documentation
└── package.json         # npm workspaces configuration
```
