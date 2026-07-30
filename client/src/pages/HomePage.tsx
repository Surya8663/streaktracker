import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/Avatar';
import { TodaysMissionCard } from '../components/TodaysMissionCard';
import { RecentLogsList } from '../components/RecentLogsList';
import { StreakCalendar } from '../components/StreakCalendar';
import { TreatBadge } from '../components/TreatBadge';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ProfileCard } from '../components/ProfileCard';
import { StudyChatPanel } from '../components/StudyChatPanel';
import { ComparisonDashboardPage } from './ComparisonDashboardPage';
import { MilestonesPage } from './MilestonesPage';
import { RoadmapPage } from './RoadmapPage';
import { ProfilePage } from './ProfilePage';
import { APP_NAME, SOCKET_EVENTS, API_ROUTES } from '@streaktrack/shared';
import type { DailyLog, StreakResponse, LogUpdatedPayload, MilestoneResponse, Month1RoadmapResponse, RoadmapUpdatedPayload, RoadmapChatMessage } from '@streaktrack/shared';
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
  const [roadmapData, setRoadmapData] = useState<Month1RoadmapResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [chatMessages, setChatMessages] = useState<RoadmapChatMessage[]>([]);

  // Fetch Month 1 Roadmap data
  const fetchRoadmapData = useCallback(async () => {
    try {
      setLoadingRoadmap(true);
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_MONTH1), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRoadmapData(data);
      }
    } catch (err) {
      console.error('Failed to fetch roadmap data', err);
    } finally {
      setLoadingRoadmap(false);
    }
  }, []);

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

  // Fetch initial chat messages for dashboard sidebar
  const fetchChatMessages = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_CHAT), { credentials: 'include' });
      if (res.ok) setChatMessages(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUserData();
    fetchRoadmapData();
    fetchChatMessages();
  }, [fetchUserData, fetchRoadmapData, fetchChatMessages]);

  // Optimized socket event handlers
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

    const handleRoadmapUpdated = (_payload: RoadmapUpdatedPayload) => {
      fetchRoadmapData();
    };

    const handleChatMessage = (newMsg: RoadmapChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdated);
    socket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);
    socket.on(SOCKET_EVENTS.ROADMAP_UPDATED, handleRoadmapUpdated);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdated);
      socket.off(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);
      socket.off(SOCKET_EVENTS.ROADMAP_UPDATED, handleRoadmapUpdated);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);
    };
  }, [socket, user, fetchStreakOnly, fetchMilestonesOnly, fetchRoadmapData]);

  const handleStartRoadmap = async () => {
    const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_MONTH1}/start`), {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to start roadmap' }));
      throw new Error(err.message || 'Failed to start roadmap');
    }
    await fetchRoadmapData();
  };

  const handleTaskToggle = async (taskId: number, isCompleted: boolean) => {
    const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${taskId}/progress`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to toggle task' }));
      throw new Error(err.message || 'Failed to toggle task');
    }
    await fetchRoadmapData();
  };

  const handleSaveDay = async (dayNumber: number, minutesStudied: number, notes?: string) => {
    const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_MONTH1}/days/${dayNumber}/save`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutesStudied, notes }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to save roadmap day' }));
      throw new Error(err.message || 'Failed to save roadmap day');
    }
    await Promise.all([fetchRoadmapData(), fetchUserData()]);
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

  // Partner info for chat panel
  const partnerProgress = roadmapData?.partnerProgress;
  const partnerIsOnline = partnerProgress ? isOnline(partnerProgress.userId) : false;
  const partnerName = partnerProgress?.userName || otherUserName;

  // Derived key stats for hero stats strip
  const currentStreak = personalStreak?.currentStreak || 0;
  const totalHours = personalStreak?.totalHours || 0;
  const longestStreak = personalStreak?.longestStreak || 0;
  const daysActive = personalStreak?.totalDaysLogged || (personalStreak?.calendarData
    ? personalStreak.calendarData.filter((d) => d.hoursSpent > 0).length
    : 0);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      {/* ── Fixed Glass Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Mark */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-teal-500 font-extrabold text-white text-xl shadow-xs">
                🔥
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                {APP_NAME}
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5 bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60">
              {TAB_CONFIG.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`btn-press cursor-pointer relative px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'text-slate-900 bg-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-stone-200/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* User Profile & Logout */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2.5 bg-stone-100/80 pl-2.5 pr-3.5 py-1.5 rounded-2xl border border-stone-200/60">
                  <Avatar name={user.name} src={user.profilePicture} size="sm" showStatus isOnline={userIsOnline} />
                  <span className="text-xs font-extrabold text-slate-800">{user.name}</span>
                </div>
              )}

              <button
                onClick={logout}
                className="btn-press cursor-pointer rounded-xl border border-stone-200/80 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-2xs hover:bg-stone-100 hover:text-rose-600 transition-all"
              >
                Logout 🚪
              </button>
            </div>

            {/* Mobile Hamburger Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              {user && <Avatar name={user.name} src={user.profilePicture} size="sm" showStatus isOnline={userIsOnline} />}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="btn-press cursor-pointer rounded-xl border border-stone-200 bg-white p-2 text-slate-700 shadow-2xs"
                aria-label="Toggle navigation menu"
              >
                <svg className="w-6 h-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-b border-stone-200 bg-white px-4 pt-2 pb-4 space-y-2 overflow-hidden"
            >
              {TAB_CONFIG.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`btn-press cursor-pointer w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-bold text-left transition-colors ${
                      isActive ? 'bg-teal-50 text-teal-900 border border-teal-200' : 'text-slate-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              <div className="pt-2 border-t border-stone-100">
                <button
                  onClick={logout}
                  className="btn-press cursor-pointer w-full text-left px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 hover:bg-rose-50 border border-rose-100 transition-colors flex items-center gap-2"
                >
                  <span>🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Main Content Container ─────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'log' && (
            <motion.div
              key="log"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="space-y-8"
            >
              {/* Gamified Welcome Banner */}
              <div className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 p-6 sm:p-8 text-white shadow-sm border-t-3 border-t-amber-400">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black text-amber-200 border border-white/20">
                        🔥 Streak Warrior
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-teal-100">
                        Leveling Up Daily
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      Welcome back, {user?.name || 'Warrior'}! 💪
                    </h1>
                    <p className="mt-1.5 text-xs sm:text-sm text-teal-100 max-w-xl font-medium leading-relaxed">
                      Complete today's concepts and problems to advance your Month 1 AI Engineer Roadmap and keep your streak alive!
                    </p>
                  </div>

                  {user && (
                    <div className="flex items-center gap-3 bg-white/15 p-3.5 rounded-2xl border border-white/20 shadow-2xs shrink-0">
                      <Avatar name={user.name} src={user.profilePicture} size="md" showStatus isOnline={userIsOnline} />
                      <div>
                        <p className="text-xs font-black text-white">{user.name}</p>
                        <p className="text-[10px] text-teal-100 font-semibold">{user.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Hero XP Stats Strip (4 Bold Cards) ─────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* 1. Current Streak Card */}
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-4 sm:p-5 text-white shadow-sm hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">🔥</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 bg-amber-200/90 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    <AnimatedCounter value={currentStreak} suffix=" days" />
                  </p>
                  <p className="text-xs font-bold text-amber-100 mt-0.5">Current Streak</p>
                </div>

                {/* 2. Total Hours Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-teal-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">⏱️</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-full">
                      All-time
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={totalHours} decimals={1} suffix=" hrs" />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Hours Logged</p>
                </div>

                {/* 3. Best Streak Record Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-amber-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">⚡</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      Record
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={longestStreak} suffix=" days" />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Best Streak Record</p>
                </div>

                {/* 4. Active Days Card */}
                <div className="rounded-2xl bg-white p-4 sm:p-5 border border-stone-200/80 border-t-3 border-t-emerald-500 shadow-2xs hover:shadow-md hover:scale-[1.01] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">🎯</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      Consistency
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <AnimatedCounter value={daysActive} suffix=" days" />
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Days Active</p>
                </div>
              </div>

              {/* Dynamic 2-Column Grid on Desktop (lg:grid lg:grid-cols-12 lg:gap-8) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ── Left Column (8 cols): Today's Mission Card & Recent Entries ── */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Today's Mission Card (Roadmap Driven) */}
                  <TodaysMissionCard
                    roadmapData={roadmapData}
                    loading={loadingRoadmap}
                    onStartRoadmap={handleStartRoadmap}
                    onTaskToggle={handleTaskToggle}
                    onSaveDay={handleSaveDay}
                    onOpenRoadmap={() => switchTab('roadmap')}
                  />

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

                {/* ── Right Sidebar (4 cols): ProfileCard, StudyChat, TreatBadge & Streak Calendar ── */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Profile Card with GitHub & LinkedIn Links */}
                  <ProfileCard user={user} isOnline={userIsOnline} />

                  {/* Study Chat Panel — now on Dashboard sidebar */}
                  <StudyChatPanel
                    messages={chatMessages}
                    currentUserId={user?.id || 0}
                    partnerName={partnerName}
                    partnerIsOnline={partnerIsOnline}
                    onNewMessage={(msg) => setChatMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])}
                  />

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
