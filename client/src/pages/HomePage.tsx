import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/Avatar';
import { DailyLogForm } from '../components/DailyLogForm';
import { RecentLogsList } from '../components/RecentLogsList';
import { StreakCalendar } from '../components/StreakCalendar';
import { TreatBadge } from '../components/TreatBadge';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ProfileCard } from '../components/ProfileCard';
import { ComparisonDashboardPage } from './ComparisonDashboardPage';
import { MilestonesPage } from './MilestonesPage';
import { RoadmapPage } from './RoadmapPage';
import { ProfilePage } from './ProfilePage';
import { APP_NAME, SOCKET_EVENTS, API_ROUTES } from '@streaktrack/shared';
import type { DailyLog, StreakResponse, LogUpdatedPayload, MilestoneResponse } from '@streaktrack/shared';
import { getApiUrl } from '../utils/api.js';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type Tab = 'log' | 'comparison' | 'milestones' | 'roadmap' | 'profile';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Dashboard', icon: '📝' },
  { id: 'comparison', label: 'Common Area', icon: '⚔️' },
  { id: 'milestones', label: 'Milestones', icon: '🏆' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

// Single fast fade transition (150ms, no transform jitter)
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  duration: 0.15,
  ease: 'linear',
};

export const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket, isOnline } = useSocket();

  const [activeTab, setActiveTab] = useState<Tab>('log');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [personalStreak, setPersonalStreak] = useState<StreakResponse | null>(null);
  const [milestoneData, setMilestoneData] = useState<MilestoneResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Fetch initial user data
  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingLogs(true);

      const [logsRes, streakRes, milestoneRes] = await Promise.all([
        fetch(getApiUrl(`${API_ROUTES.LOGS}/${user.id}`), { credentials: 'include' }),
        fetch(getApiUrl(`${API_ROUTES.STREAKS}/${user.id}`), { credentials: 'include' }),
        fetch(getApiUrl(API_ROUTES.MILESTONES), { credentials: 'include' }),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (streakRes.ok) {
        const streakData = await streakRes.json();
        setPersonalStreak(streakData);
      }
      if (milestoneRes.ok) {
        const mData = await milestoneRes.json();
        setMilestoneData(mData);
      }
    } catch (err) {
      console.error('Failed to fetch user data', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [user]);

  // Granular fetch helpers to avoid heavy re-fetches
  const fetchStreakOnly = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.STREAKS}/${user.id}`), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPersonalStreak(data);
      }
    } catch (err) {
      console.error('Failed to fetch streak', err);
    }
  }, [user]);

  const fetchMilestonesOnly = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(API_ROUTES.MILESTONES), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMilestoneData(data);
      }
    } catch (err) {
      console.error('Failed to fetch milestones', err);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Optimized socket event handlers (update state locally & fetch targeted resource)
  useEffect(() => {
    if (!socket) return;

    const handleLogUpdated = (payload: LogUpdatedPayload) => {
      if (user && payload.userId === user.id) {
        setLogs((prev) => {
          const existingIdx = prev.findIndex((l) => l.id === payload.log.id || l.date === payload.log.date);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = payload.log;
            return updated;
          }
          return [payload.log, ...prev];
        });
        fetchStreakOnly();
      }
    };

    const handleMilestoneCompleted = () => {
      fetchMilestonesOnly();
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdated);
    socket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdated);
      socket.off(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);
    };
  }, [socket, user, fetchStreakOnly, fetchMilestonesOnly]);

  const todayStr = getTodayString();
  const todayLog = logs.find((l) => l.date === todayStr) || null;

  const handleLogSaved = (savedLog: DailyLog) => {
    setLogs((prev) => {
      const existingIdx = prev.findIndex((l) => l.id === savedLog.id || l.date === savedLog.date);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = savedLog;
        return updated;
      }
      return [savedLog, ...prev];
    });
    fetchStreakOnly();
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const userIsOnline = user ? isOnline(user.id) : false;

  const treatsOwedCount = user && milestoneData
    ? milestoneData.treatScoreboard.find((t) => t.userId === user.id)?.treatsOwed || 0
    : 0;
  const otherUserName = user?.name === 'Surya' ? 'Gomathi' : 'Surya';

  // Derived key stats for hero stats strip
  const currentStreak = personalStreak?.currentStreak || 0;
  const totalHours = personalStreak?.totalHours || 0;
  const longestStreak = personalStreak?.longestStreak || 0;
  const daysActive = personalStreak?.totalDaysLogged || (personalStreak?.calendarData
    ? personalStreak.calendarData.filter((d) => d.hoursSpent > 0).length
    : 0);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      {/* ═══ Top Navigation Bar (Single Sticky Blur Header) ═══ */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 font-bold text-white shadow-sm text-sm">
              ST
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
              {APP_NAME}
            </span>
          </div>

          {/* Desktop Tab Navigation */}
          <nav className="hidden md:flex items-center rounded-2xl bg-stone-100/80 p-1 border border-stone-200/60">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`btn-press cursor-pointer rounded-xl px-3 lg:px-4 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right: User + Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* User Avatar (clickable → profile) */}
            <div
              className="hidden sm:flex items-center gap-2 cursor-pointer rounded-xl p-1.5 hover:bg-stone-100 transition-colors"
              onClick={() => switchTab('profile')}
              title="View Profile"
            >
              <Avatar name={user?.name || ''} src={user?.profilePicture} size="sm" showStatus isOnline={userIsOnline} />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="btn-press cursor-pointer rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:bg-stone-50 hover:text-slate-900 transition-colors"
            >
              Sign Out
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden cursor-pointer rounded-xl border border-stone-200 bg-white p-2 text-sm shadow-xs hover:bg-stone-50"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden overflow-hidden border-t border-stone-200/60 bg-white"
            >
              <div className="px-4 py-3 space-y-1">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`btn-press cursor-pointer w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'text-slate-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ═══ Main Content with Fast Single-Fade Page Transitions ═══ */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'log' && (
            <motion.div
              key="log"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="space-y-6 sm:space-y-8"
            >
              {/* Profile Welcome Banner (Gamified Energy Header) */}
              <div className="rounded-3xl border border-stone-200/80 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-emerald-500/10 p-6 sm:p-7 shadow-xs border-t-3 border-t-amber-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 sm:gap-5 cursor-pointer" onClick={() => switchTab('profile')}>
                    <Avatar name={user?.name || ''} src={user?.profilePicture} size="xl" showStatus isOnline={userIsOnline} />
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="rounded-full bg-amber-500/20 text-amber-950 text-[11px] font-black px-2.5 py-0.5 border border-amber-300/60 shadow-2xs">
                          🔥 Streak Warrior
                        </span>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-900 text-[11px] font-extrabold px-2.5 py-0.5 border border-emerald-300/50">
                          Leveling Up
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Welcome back, {user?.name}! 👋
                      </h1>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-600 font-medium">
                        Track your daily study progress and keep your momentum burning.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold shadow-2xs">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        socket?.connected
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-700 font-bold">
                      {socket?.connected ? `${user?.name} (Online)` : 'Connecting...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hero XP Stats Strip (4 Bold Achievement Cards) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Current Streak Card (Hero Vivid Flame Gradient) */}
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white p-4 sm:p-5 shadow-md border border-amber-400/40 hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">🔥</span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full backdrop-blur-2xs">
                      Current
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
                    <AnimatedCounter value={currentStreak} />
                  </p>
                  <p className="text-xs font-bold text-amber-100/90 mt-0.5">
                    {currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
                  </p>
                </div>

                {/* 2. Total Hours Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-emerald-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">⏱️</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      All-Time
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={totalHours} decimals={1} />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Hours Logged</p>
                </div>

                {/* 3. Longest Streak Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-amber-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">⚡</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      Record
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={longestStreak} />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Best Streak Record</p>
                </div>

                {/* 4. Active Days Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-teal-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">🎯</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-full">
                      Consistency
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={daysActive} />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Days Active</p>
                </div>
              </div>

              {/* Dynamic 2-Column Grid on Desktop (lg:grid lg:grid-cols-12 lg:gap-8) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ── Left Column (8 cols): Daily Log Form & Recent Entries ── */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Daily Log Form */}
                  <section className="rounded-3xl border border-stone-200/80 bg-white shadow-2xs border-t-3 border-t-teal-500 overflow-hidden">
                    <DailyLogForm todayLog={todayLog} onLogSaved={handleLogSaved} />
                  </section>

                  {/* Recent Logs List with Pulse Skeleton Loader */}
                  <section>
                    {loadingLogs ? (
                      <div className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="h-6 w-36 bg-stone-200/80 rounded-lg animate-pulse" />
                          <div className="h-4 w-20 bg-stone-100 rounded-lg animate-pulse" />
                        </div>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="rounded-2xl border border-stone-100 p-5 space-y-3 bg-stone-50/50 animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="h-4 w-28 bg-stone-200 rounded-md" />
                              <div className="h-4 w-16 bg-amber-100 rounded-full" />
                            </div>
                            <div className="h-5 w-3/4 bg-stone-200 rounded-md" />
                            <div className="h-3 w-1/2 bg-stone-100 rounded-md" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <RecentLogsList logs={logs} />
                    )}
                  </section>
                </div>

                {/* ── Right Sidebar (4 cols): ProfileCard, TreatBadge & Personal Streak Calendar ── */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Profile Card with GitHub & LinkedIn Links */}
                  <ProfileCard user={user} isOnline={userIsOnline} />

                  {/* Treat Badge */}
                  <TreatBadge
                    otherUserName={otherUserName}
                    treatsOwedCount={treatsOwedCount}
                    onClick={() => switchTab('milestones')}
                  />

                  {/* Personal Streak Calendar */}
                  {personalStreak && (
                    <section className="rounded-3xl border border-stone-200/80 bg-white p-2 shadow-2xs border-t-3 border-t-amber-500">
                      <StreakCalendar data={personalStreak} isOnline={userIsOnline} />
                    </section>
                  )}

                  {/* Quick Streak Highlights / XP Card */}
                  {milestoneData?.currentBlock && (
                    <div className="rounded-3xl border border-stone-200/80 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-stone-50 p-6 shadow-2xs space-y-3 border-t-3 border-t-amber-400">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏆</span>
                        <h3 className="font-black text-slate-800 text-sm">Sprint Milestone Status</h3>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Block #{milestoneData.currentBlock.blockNumber} ends in <span className="font-extrabold text-amber-900">{milestoneData.currentBlock.daysRemaining} days</span>. Keep logging daily to claim treat bragging rights! 🍫
                      </p>
                      <button
                        onClick={() => switchTab('milestones')}
                        className="btn-press cursor-pointer w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-4 shadow-xs transition-colors"
                      >
                        View Milestones & Scoreboard →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'comparison' && (
            <motion.div
              key="comparison"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <ComparisonDashboardPage />
            </motion.div>
          )}

          {activeTab === 'milestones' && (
            <motion.div
              key="milestones"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <MilestonesPage />
            </motion.div>
          )}

          {activeTab === 'roadmap' && (
            <motion.div
              key="roadmap"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <RoadmapPage />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <ProfilePage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
