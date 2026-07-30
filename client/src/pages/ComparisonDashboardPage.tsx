import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import type { StreakResponse, User, LogUpdatedPayload, MilestoneResponse, DailyLog, MilestoneWonPayload } from '@streaktrack/shared';
import { API_ROUTES, SOCKET_EVENTS } from '@streaktrack/shared';
import { StreakCalendar } from '../components/StreakCalendar';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { TreatBadge } from '../components/TreatBadge';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api.js';

function formatRelativeTime(dateStr: string, createdAtStr?: string): string {
  const targetDate = createdAtStr ? new Date(createdAtStr) : new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (isNaN(targetDate.getTime())) return dateStr;
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPercentages(val1: number, val2: number) {
  const sum = val1 + val2;
  if (sum === 0) return { pct1: 50, pct2: 50 };
  let pct1 = (val1 / sum) * 100;
  let pct2 = (val2 / sum) * 100;
  if (val1 > 0 && pct1 < 12) { pct1 = 12; pct2 = 88; }
  if (val2 > 0 && pct2 < 12) { pct2 = 12; pct1 = 88; }
  return { pct1, pct2 };
}

interface StatRowProps {
  title: string;
  icon: string;
  val1: number;
  val2: number;
  unit?: string;
  decimals?: number;
  delay: number;
}

const StatRow: React.FC<StatRowProps> = ({ title, icon, val1, val2, unit = '', decimals = 0, delay }) => {
  const { pct1, pct2 } = getPercentages(val1, val2);
  const formattedVal1 = decimals > 0 ? val1.toFixed(decimals) : val1;
  const formattedVal2 = decimals > 0 ? val2.toFixed(decimals) : val2;

  const is1Winner = val1 > val2;
  const is2Winner = val2 > val1;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
        <div className={`flex items-center gap-1 ${is1Winner ? 'text-amber-700 font-extrabold' : 'text-slate-600'}`}>
          <span>{formattedVal1} {unit}</span>
          {is1Winner && <span className="text-xs">🏆</span>}
        </div>

        <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
          <span>{icon}</span>
          <span>{title}</span>
        </div>

        <div className={`flex items-center gap-1 ${is2Winner ? 'text-emerald-700 font-extrabold' : 'text-slate-600'}`}>
          {is2Winner && <span className="text-xs">🏆</span>}
          <span>{formattedVal2} {unit}</span>
        </div>
      </div>

      <div className="relative h-9 w-full rounded-2xl bg-stone-100 border border-stone-200/80 p-1 flex items-center gap-1 shadow-inner overflow-hidden">
        {/* Surya (Left) Bar */}
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${pct1}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay }}
          className="h-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 text-amber-950 font-extrabold text-xs flex items-center justify-end pr-2.5 shadow-xs overflow-hidden whitespace-nowrap min-w-0"
        >
          {pct1 >= 15 && (
            <span className="drop-shadow-xs">
              {formattedVal1}{unit ? ` ${unit}` : ''}
            </span>
          )}
        </motion.div>

        {/* Gomathi (Right) Bar */}
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: `${pct2}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay }}
          className="h-full rounded-xl bg-gradient-to-l from-emerald-400 via-emerald-500 to-teal-400 text-emerald-950 font-extrabold text-xs flex items-center justify-start pl-2.5 shadow-xs overflow-hidden whitespace-nowrap min-w-0"
        >
          {pct2 >= 15 && (
            <span className="drop-shadow-xs">
              {formattedVal2}{unit ? ` ${unit}` : ''}
            </span>
          )}
        </motion.div>

        {/* Center Divider indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-white/90 z-10 shadow-xs" />
      </div>
    </div>
  );
};

// Motion container variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: 'easeOut',
    },
  },
};

export const ComparisonDashboardPage: React.FC = () => {
  const { socket, isOnline } = useSocket();
  const [streaks, setStreaks] = useState<StreakResponse[]>([]);
  const [milestoneData, setMilestoneData] = useState<MilestoneResponse | null>(null);
  const [latestLogs, setLatestLogs] = useState<Record<number, DailyLog | null>>({});
  const [flashUserIds, setFlashUserIds] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllStreaks = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch users list and milestones
      const [usersRes, milestoneRes] = await Promise.all([
        fetch(getApiUrl(API_ROUTES.USERS), { credentials: 'include' }),
        fetch(getApiUrl(API_ROUTES.MILESTONES), { credentials: 'include' }),
      ]);

      if (!usersRes.ok) throw new Error('Failed to load users');
      const usersData = await usersRes.json();
      const usersList: User[] = usersData.users || [];

      if (milestoneRes.ok) {
        const mData: MilestoneResponse = await milestoneRes.json();
        setMilestoneData(mData);
      }

      // Fetch streak and latest log for each user in parallel
      const streakPromises = usersList.map((u) =>
        fetch(getApiUrl(`${API_ROUTES.STREAKS}/${u.id}`), { credentials: 'include' }).then((r) => r.json()),
      );
      const logPromises = usersList.map((u) =>
        fetch(getApiUrl(`${API_ROUTES.LOGS}/${u.id}`), { credentials: 'include' }).then((r) => r.json()),
      );

      const [streakResults, logResults] = await Promise.all([
        Promise.all(streakPromises),
        Promise.all(logPromises),
      ]);

      setStreaks(streakResults);

      const logsMap: Record<number, DailyLog | null> = {};
      usersList.forEach((u, idx) => {
        const userLogs: DailyLog[] = logResults[idx]?.logs || [];
        logsMap[u.id] = userLogs.length > 0 ? userLogs[0] : null;
      });
      setLatestLogs(logsMap);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load streak comparison data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllStreaks();
  }, [loadAllStreaks]);

  // Socket updates
  useEffect(() => {
    if (!socket) return;

    const handleLogUpdate = (payload: LogUpdatedPayload) => {
      setLatestLogs((prev) => ({ ...prev, [payload.userId]: payload.log }));
      setFlashUserIds((prev) => ({ ...prev, [payload.userId]: Date.now() }));
      loadAllStreaks();
    };

    const handleMilestoneCompleted = (payload: MilestoneWonPayload) => {
      loadAllStreaks();
      const winnerName = payload.milestone.winnerName || 'Someone';

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      toast.success(`🎉 ${winnerName} won this block!`, {
        duration: 6000,
        position: 'top-center',
        style: {
          borderRadius: '16px',
          background: '#0f172a',
          color: '#fff',
          fontWeight: 'bold',
        },
      });
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
    socket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
      socket.off(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);
    };
  }, [socket, loadAllStreaks]);

  if (loading && streaks.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading Common Area...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }

  // Calculate Leader
  let leader: User | null = null;
  let maxStreak = -1;
  let totalTeamHours = 0;

  streaks.forEach((s: StreakResponse) => {
    totalTeamHours += s.totalHours;
    if (s.currentStreak > maxStreak) {
      maxStreak = s.currentStreak;
      leader = s.user;
    }
  });

  // Find Surya and Gomathi streaks
  const suryaStreak = streaks.find((s) => s.user.name.toLowerCase().includes('surya')) || streaks[0];
  const gomathiStreak = streaks.find((s) => s.user.name.toLowerCase().includes('gomathi')) || (streaks.length > 1 ? streaks[1] : null);

  const isSuryaLeading = suryaStreak && gomathiStreak && suryaStreak.currentStreak > gomathiStreak.currentStreak;
  const isGomathiLeading = suryaStreak && gomathiStreak && gomathiStreak.currentStreak > suryaStreak.currentStreak;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ── 1. Current Battle Banner ─────────────────────────── */}
      {milestoneData?.currentBlock && (
        <motion.div
          variants={sectionVariants}
          className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-stone-50 p-6 sm:p-7 shadow-sm space-y-4 relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Block & Days Remaining */}
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="rounded-full bg-amber-200/60 text-amber-950 text-xs font-black px-3 py-0.5 border border-amber-300/60 shadow-2xs">
                  ⚔️ 5-Day Block #{milestoneData.currentBlock.blockNumber}
                </span>
                <span className="text-xs font-extrabold text-amber-900 bg-white/90 px-2.5 py-0.5 rounded-full border border-amber-200/70 shadow-2xs">
                  ⏳ {milestoneData.currentBlock.daysRemaining} {milestoneData.currentBlock.daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Current Battle Status
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
                Active Block: {milestoneData.currentBlock.startDate} to {milestoneData.currentBlock.endDate}
              </p>
            </div>

            {/* Leading Status Indicator */}
            <div className="flex items-center gap-3 bg-white/95 p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
              {(() => {
                const cb = milestoneData.currentBlock;
                const u1Name = cb.user1Name;
                const u2Name = cb.user2Name;
                const u1Hours = cb.user1Hours;
                const u2Hours = cb.user2Hours;

                if (u1Hours === u2Hours) {
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🤝</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</p>
                        <p className="text-sm font-black text-slate-800">Dead Heat — Tied ({u1Hours.toFixed(1)} hrs)</p>
                      </div>
                    </div>
                  );
                }

                const leadingName = u1Hours > u2Hours ? u1Name : u2Name;
                const leadingHours = u1Hours > u2Hours ? u1Hours : u2Hours;
                const trailingHours = u1Hours > u2Hours ? u2Hours : u1Hours;
                const leadDiff = (leadingHours - trailingHours).toFixed(1);
                const isSuryaLeadingBlock = u1Hours > u2Hours;

                return (
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-2xl shrink-0"
                    >
                      🔥
                    </motion.div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSuryaLeadingBlock ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          Leading Now 👑
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
                        {leadingName} (+{leadDiff} hrs ahead)
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Treat Badges Section */}
          {milestoneData.treatScoreboard && milestoneData.treatScoreboard.some((t) => t.treatsOwed > 0) && (
            <div className="pt-3 border-t border-amber-200/50 grid grid-cols-1 md:grid-cols-2 gap-3">
              {milestoneData.treatScoreboard.map((t) => {
                if (t.treatsOwed <= 0) return null;
                const recipientName = suryaStreak && gomathiStreak
                  ? (t.userId === suryaStreak.user.id ? gomathiStreak.user.name : suryaStreak.user.name)
                  : 'Friend';
                return (
                  <TreatBadge
                    key={`treat-${t.userId}`}
                    otherUserName={recipientName}
                    treatsOwedCount={t.treatsOwed}
                  />
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── 2. VS Hero Section (Vertical Stack on Mobile) ─────── */}
      {suryaStreak && gomathiStreak && (
        <motion.div variants={sectionVariants}>
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 py-2">
            {/* Left Card: Surya with hover 3D tilt */}
            <motion.div
              whileHover={{ scale: 1.025, y: -4, rotateY: -3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
              className={`relative w-full sm:w-auto flex-1 flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl border text-center transition-all duration-300 ${
                isSuryaLeading
                  ? 'bg-gradient-to-br from-amber-100/80 via-amber-50/60 to-stone-50 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-stone-50 border-stone-200/80 shadow-xs'
              }`}
            >
              {/* Leading Crown Badge */}
              {isSuryaLeading && (
                <motion.div
                  initial={{ scale: 0, y: 10, rotate: -15 }}
                  animate={{ scale: 1, y: 0, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.4 }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 font-black text-xs px-3.5 py-1 rounded-full shadow-md flex items-center gap-1 border border-amber-200 ring-2 ring-amber-300/50 z-10"
                >
                  <span>👑</span> Leading
                </motion.div>
              )}

              {/* Avatar Container */}
              <div className={`relative p-1.5 rounded-full transition-all duration-300 ${
                isSuryaLeading ? 'ring-4 ring-amber-400/80 shadow-lg shadow-amber-400/30' : ''
              }`}>
                <Avatar
                  name={suryaStreak.user.name}
                  src={suryaStreak.user.profilePicture}
                  size="xl"
                  showStatus
                  isOnline={isOnline(suryaStreak.user.id)}
                />
              </div>

              <h3 className="mt-3 text-lg font-extrabold text-slate-800 tracking-tight">
                {suryaStreak.user.name}
              </h3>

              <div className="mt-1.5 flex items-center gap-1.5 text-sm font-extrabold text-amber-800 bg-amber-100/90 px-4 py-1 rounded-full border border-amber-200/80 shadow-2xs">
                <span className="text-base">🔥</span>
                <AnimatedCounter value={suryaStreak.currentStreak} />
                <span>{suryaStreak.currentStreak === 1 ? 'day' : 'days'}</span>
              </div>
            </motion.div>

            {/* Center VS Badge */}
            <div className="z-10 -my-2 sm:my-0 flex items-center justify-center shrink-0">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-rose-500/30 ring-4 ring-white border border-white/60"
              >
                VS
              </motion.div>
            </div>

            {/* Right Card: Gomathi with hover 3D tilt */}
            <motion.div
              whileHover={{ scale: 1.025, y: -4, rotateY: 3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
              className={`relative w-full sm:w-auto flex-1 flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl border text-center transition-all duration-300 ${
                isGomathiLeading
                  ? 'bg-gradient-to-br from-emerald-100/80 via-emerald-50/60 to-stone-50 border-emerald-300 shadow-md ring-2 ring-emerald-400/40'
                  : 'bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-stone-50 border-stone-200/80 shadow-xs'
              }`}
            >
              {/* Leading Crown Badge */}
              {isGomathiLeading && (
                <motion.div
                  initial={{ scale: 0, y: 10, rotate: 15 }}
                  animate={{ scale: 1, y: 0, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.4 }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-400 text-emerald-950 font-black text-xs px-3.5 py-1 rounded-full shadow-md flex items-center gap-1 border border-emerald-200 ring-2 ring-emerald-300/50 z-10"
                >
                  <span>👑</span> Leading
                </motion.div>
              )}

              {/* Avatar Container */}
              <div className={`relative p-1.5 rounded-full transition-all duration-300 ${
                isGomathiLeading ? 'ring-4 ring-emerald-400/80 shadow-lg shadow-emerald-400/30' : ''
              }`}>
                <Avatar
                  name={gomathiStreak.user.name}
                  src={gomathiStreak.user.profilePicture}
                  size="xl"
                  showStatus
                  isOnline={isOnline(gomathiStreak.user.id)}
                />
              </div>

              <h3 className="mt-3 text-lg font-extrabold text-slate-800 tracking-tight">
                {gomathiStreak.user.name}
              </h3>

              <div className="mt-1.5 flex items-center gap-1.5 text-sm font-extrabold text-emerald-800 bg-emerald-100/90 px-4 py-1 rounded-full border border-emerald-200/80 shadow-2xs">
                <span className="text-base">🔥</span>
                <AnimatedCounter value={gomathiStreak.currentStreak} />
                <span>{gomathiStreak.currentStreak === 1 ? 'day' : 'days'}</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ── 3. Head-to-Head Racing Stats ──────────────────────── */}
      {suryaStreak && gomathiStreak && (
        <motion.div
          variants={sectionVariants}
          className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6"
        >
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏁</span>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  Head-to-Head Racing Stats
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Tug-of-war progress comparison across key performance metrics
              </p>
            </div>

            {/* Legend / User Indicators */}
            <div className="flex items-center gap-3 text-xs font-bold mt-1 sm:mt-0">
              <div className="flex items-center gap-1.5 text-amber-900 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-200/60 shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>{suryaStreak.user.name}</span>
              </div>
              <span className="text-slate-300 font-semibold">vs</span>
              <div className="flex items-center gap-1.5 text-emerald-900 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200/60 shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{gomathiStreak.user.name}</span>
              </div>
            </div>
          </div>

          {/* Stat Rows */}
          {(() => {
            let suryaBlockHours = 0;
            let gomathiBlockHours = 0;
            if (milestoneData?.currentBlock) {
              const cb = milestoneData.currentBlock;
              if (cb.user1Id === suryaStreak.user.id) {
                suryaBlockHours = cb.user1Hours;
                gomathiBlockHours = cb.user2Hours;
              } else if (cb.user2Id === suryaStreak.user.id) {
                suryaBlockHours = cb.user2Hours;
                gomathiBlockHours = cb.user1Hours;
              }
            }

            return (
              <div className="space-y-6 pt-1">
                <StatRow
                  title="Total Hours Logged (All-Time)"
                  icon="⏱️"
                  val1={suryaStreak.totalHours}
                  val2={gomathiStreak.totalHours}
                  unit="hrs"
                  decimals={1}
                  delay={0.2}
                />

                <StatRow
                  title="Current Streak"
                  icon="🔥"
                  val1={suryaStreak.currentStreak}
                  val2={gomathiStreak.currentStreak}
                  unit="days"
                  decimals={0}
                  delay={0.3}
                />

                <StatRow
                  title="Longest Streak"
                  icon="⚡"
                  val1={suryaStreak.longestStreak}
                  val2={gomathiStreak.longestStreak}
                  unit="days"
                  decimals={0}
                  delay={0.4}
                />

                <StatRow
                  title="Current 5-Day Block Hours"
                  icon="🍫"
                  val1={suryaBlockHours}
                  val2={gomathiBlockHours}
                  unit="hrs"
                  decimals={1}
                  delay={0.5}
                />
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ── 4. What We're Working On Section ──────────────────── */}
      {suryaStreak && gomathiStreak && (
        <motion.div
          variants={sectionVariants}
          className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6"
        >
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  What We're Working On
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Real-time snapshot of the latest daily study topics and notes
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live Sync</span>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Surya Card */}
            {(() => {
              const log = latestLogs[suryaStreak.user.id];
              const flashKey = flashUserIds[suryaStreak.user.id] || 0;
              return (
                <motion.div
                  key={`surya-log-${flashKey}`}
                  initial={{ scale: 1 }}
                  animate={{
                    scale: flashKey ? [1, 1.02, 1] : 1,
                    borderColor: flashKey ? ['#f59e0b', '#fde68a', '#e7e5e4'] : '#e7e5e4',
                    backgroundColor: flashKey ? ['#fffbeb', '#ffffff'] : '#ffffff',
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-stone-200/80 bg-gradient-to-br from-amber-50/40 via-white to-stone-50 shadow-2xs relative overflow-hidden"
                >
                  <div>
                    {/* Header: Avatar + Name + Timestamp */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={suryaStreak.user.name}
                          src={suryaStreak.user.profilePicture}
                          size="md"
                          showStatus
                          isOnline={isOnline(suryaStreak.user.id)}
                        />
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">{suryaStreak.user.name}</h4>
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                            Surya
                          </span>
                        </div>
                      </div>

                      {log && (
                        <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200/60 shadow-2xs">
                          🕒 {formatRelativeTime(log.date, log.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Log Content */}
                    {log ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Topics Studied
                          </p>
                          <p className="text-sm font-bold text-slate-800 leading-snug">
                            {log.topicsStudied}
                          </p>
                        </div>

                        {log.notes && (
                          <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200/60 text-xs text-amber-950 font-medium">
                            <span className="font-bold text-amber-900 block mb-0.5">📌 Notes</span>
                            {log.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-stone-400 italic">
                        No daily logs recorded yet.
                      </div>
                    )}
                  </div>

                  {/* Footer: Hours Spent */}
                  {log && (
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold">
                      <span className="text-stone-500">Duration</span>
                      <span className="text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full border border-amber-200/60">
                        ⏱️ {log.hoursSpent} hrs logged
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })()}

            {/* Gomathi Card */}
            {(() => {
              const log = latestLogs[gomathiStreak.user.id];
              const flashKey = flashUserIds[gomathiStreak.user.id] || 0;
              return (
                <motion.div
                  key={`gomathi-log-${flashKey}`}
                  initial={{ scale: 1 }}
                  animate={{
                    scale: flashKey ? [1, 1.02, 1] : 1,
                    borderColor: flashKey ? ['#10b981', '#a7f3d0', '#e7e5e4'] : '#e7e5e4',
                    backgroundColor: flashKey ? ['#ecfdf5', '#ffffff'] : '#ffffff',
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-stone-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-stone-50 shadow-2xs relative overflow-hidden"
                >
                  <div>
                    {/* Header: Avatar + Name + Timestamp */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={gomathiStreak.user.name}
                          src={gomathiStreak.user.profilePicture}
                          size="md"
                          showStatus
                          isOnline={isOnline(gomathiStreak.user.id)}
                        />
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">{gomathiStreak.user.name}</h4>
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            Gomathi
                          </span>
                        </div>
                      </div>

                      {log && (
                        <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200/60 shadow-2xs">
                          🕒 {formatRelativeTime(log.date, log.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Log Content */}
                    {log ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Topics Studied
                          </p>
                          <p className="text-sm font-bold text-slate-800 leading-snug">
                            {log.topicsStudied}
                          </p>
                        </div>

                        {log.notes && (
                          <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/60 text-xs text-emerald-950 font-medium">
                            <span className="font-bold text-emerald-900 block mb-0.5">📌 Notes</span>
                            {log.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-stone-400 italic">
                        No daily logs recorded yet.
                      </div>
                    )}
                  </div>

                  {/* Footer: Hours Spent */}
                  {log && (
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold">
                      <span className="text-stone-500">Duration</span>
                      <span className="text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200/60">
                        ⏱️ {log.hoursSpent} hrs logged
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* ── 5. Light-Theme Comparison Overview Card ─────────── */}
      <motion.div
        variants={sectionVariants}
        className="rounded-3xl border border-teal-200/80 bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-stone-50 p-6 sm:p-8 text-slate-800 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="inline-block rounded-full bg-teal-100/90 text-teal-900 px-3 py-1 text-xs font-bold border border-teal-200/80 mb-2">
              📊 Side-by-Side Comparison
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Habit & Streak Leaderboard
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-lg">
              Visually comparing daily study activity and streaks between Surya and Gomathi over the last 6 months.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Total Combined Team Hours */}
            <div className="rounded-2xl bg-white/95 px-5 py-3 border border-teal-200/70 shadow-2xs text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                Combined Hours
              </p>
              <p className="text-xl font-black text-slate-900">
                <AnimatedCounter value={totalTeamHours} decimals={1} suffix=" hrs" />
              </p>
            </div>

            {/* Streak Leader */}
            {leader && maxStreak > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-amber-100/90 px-5 py-3 border border-amber-300/80 shadow-2xs">
                <Avatar name={(leader as User).name} src={(leader as User).profilePicture} size="sm" showStatus isOnline={isOnline((leader as User).id)} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Streak Leader 🔥
                  </p>
                  <p className="text-sm font-black text-amber-950">
                    {(leader as User).name} ({maxStreak} {maxStreak === 1 ? 'day' : 'days'})
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── 6. Side-by-side Streak Calendars Grid ─────────────── */}
      <motion.div variants={sectionVariants} className="grid grid-cols-1 gap-8">
        {streaks.map((streakData) => (
          <div key={streakData.user.id}>
            <StreakCalendar data={streakData} isOnline={isOnline(streakData.user.id)} />
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};
