import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/Avatar';
import { DailyLogForm } from '../components/DailyLogForm';
import { RecentLogsList } from '../components/RecentLogsList';
import { StreakCalendar } from '../components/StreakCalendar';
import { TreatBadge } from '../components/TreatBadge';
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
  { id: 'comparison', label: 'Streaks', icon: '🔥' },
  { id: 'milestones', label: 'Milestones', icon: '🏆' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

const pageVariants = {
  initial: { opacity: 0, y: 16, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.25,
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

  // Fetch logs, personal streak stats, and milestone treats for current user
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

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Listen to socket log update & milestone events
  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      fetchUserData();
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleRefresh);
    socket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, handleRefresh);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleRefresh);
      socket.off(SOCKET_EVENTS.MILESTONE_COMPLETED, handleRefresh);
    };
  }, [socket, user, fetchUserData]);

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
    fetchUserData();
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

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      {/* ═══ Top Navigation Bar ═══ */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-xl">
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
              transition={{ duration: 0.2 }}
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

      {/* ═══ Main Content with Page Transitions ═══ */}
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
              {/* Profile Welcome Banner */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="glass-card p-5 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 sm:gap-5 cursor-pointer" onClick={() => switchTab('profile')}>
                    <Avatar name={user?.name || ''} src={user?.profilePicture} size="xl" showStatus isOnline={userIsOnline} />
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        Welcome back, {user?.name}! 👋
                      </h1>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                        Track your daily progress and keep your study streak alive.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        socket?.connected
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-600 font-semibold">
                      {socket?.connected ? `${user?.name} (Online)` : 'Connecting...'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Treat Badge */}
              <TreatBadge
                otherUserName={otherUserName}
                treatsOwedCount={treatsOwedCount}
                onClick={() => switchTab('milestones')}
              />

              {/* Personal Streak Calendar */}
              {personalStreak && (
                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                >
                  <StreakCalendar data={personalStreak} isOnline={userIsOnline} />
                </motion.section>
              )}

              {/* Daily Log Form */}
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <DailyLogForm todayLog={todayLog} onLogSaved={handleLogSaved} />
              </motion.section>

              {/* Recent Logs */}
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                {loadingLogs ? (
                  <div className="glass-card p-8 text-center text-slate-400 text-sm">
                    Loading recent entries...
                  </div>
                ) : (
                  <RecentLogsList logs={logs} />
                )}
              </motion.section>
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
