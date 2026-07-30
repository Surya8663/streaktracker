import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { StreakResponse, User, LogUpdatedPayload, MilestoneResponse } from '@streaktrack/shared';
import { API_ROUTES, SOCKET_EVENTS } from '@streaktrack/shared';
import { StreakCalendar } from '../components/StreakCalendar';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api.js';

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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-white/70 backdrop-blur-xs z-10 shadow-xs" />
      </div>
    </div>
  );
};

export const ComparisonDashboardPage: React.FC = () => {
  const { socket, isOnline } = useSocket();
  const [streaks, setStreaks] = useState<StreakResponse[]>([]);
  const [milestoneData, setMilestoneData] = useState<MilestoneResponse | null>(null);
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

      // Fetch streak for each user
      const streakPromises = usersList.map((u) =>
        fetch(getApiUrl(`${API_ROUTES.STREAKS}/${u.id}`), { credentials: 'include' }).then((r) => r.json()),
      );

      const streakResults: StreakResponse[] = await Promise.all(streakPromises);
      setStreaks(streakResults);
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

    const handleLogUpdate = (_payload: LogUpdatedPayload) => {
      loadAllStreaks();
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
    };
  }, [socket, loadAllStreaks]);

  if (loading && streaks.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading streak calendars...</p>
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
    <div className="space-y-8">
      {/* ── VS Hero Section ───────────────────────────────────── */}
      {suryaStreak && gomathiStreak && (
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 py-2">
          {/* Left Card: Surya */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 90, damping: 15 }}
            className={`relative flex-1 w-full flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl border text-center transition-all duration-300 ${
              isSuryaLeading
                ? 'bg-gradient-to-br from-amber-500/15 via-amber-100/50 to-orange-50/90 border-amber-300/90 shadow-md ring-2 ring-amber-400/40'
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

            {/* Avatar Container with glowing ring if leading */}
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

            {/* Name */}
            <h3 className="mt-3 text-lg font-extrabold text-slate-800 tracking-tight">
              {suryaStreak.user.name}
            </h3>

            {/* Current Streak Counter */}
            <div className="mt-1.5 flex items-center gap-1.5 text-sm font-extrabold text-amber-800 bg-amber-100/90 px-4 py-1 rounded-full border border-amber-200/80 shadow-xs">
              <span className="text-base">🔥</span>
              <AnimatedCounter value={suryaStreak.currentStreak} />
              <span>{suryaStreak.currentStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </motion.div>

          {/* Center VS Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.35 }}
            className="z-10 -my-3 sm:my-0 flex items-center justify-center shrink-0"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-rose-500/30 ring-4 ring-white border border-white/50"
            >
              VS
            </motion.div>
          </motion.div>

          {/* Right Card: Gomathi */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 90, damping: 15 }}
            className={`relative flex-1 w-full flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl border text-center transition-all duration-300 ${
              isGomathiLeading
                ? 'bg-gradient-to-br from-emerald-500/15 via-emerald-100/50 to-teal-50/90 border-emerald-300/90 shadow-md ring-2 ring-emerald-400/40'
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

            {/* Avatar Container with glowing ring if leading */}
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

            {/* Name */}
            <h3 className="mt-3 text-lg font-extrabold text-slate-800 tracking-tight">
              {gomathiStreak.user.name}
            </h3>

            {/* Current Streak Counter */}
            <div className="mt-1.5 flex items-center gap-1.5 text-sm font-extrabold text-emerald-800 bg-emerald-100/90 px-4 py-1 rounded-full border border-emerald-200/80 shadow-xs">
              <span className="text-base">🔥</span>
              <AnimatedCounter value={gomathiStreak.currentStreak} />
              <span>{gomathiStreak.currentStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Head-to-Head Racing Stats ──────────────────────────── */}
      {suryaStreak && gomathiStreak && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
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
                  delay={0.25}
                />

                <StatRow
                  title="Current Streak"
                  icon="🔥"
                  val1={suryaStreak.currentStreak}
                  val2={gomathiStreak.currentStreak}
                  unit="days"
                  decimals={0}
                  delay={0.35}
                />

                <StatRow
                  title="Longest Streak"
                  icon="⚡"
                  val1={suryaStreak.longestStreak}
                  val2={gomathiStreak.longestStreak}
                  unit="days"
                  decimals={0}
                  delay={0.45}
                />

                <StatRow
                  title="Current 5-Day Block Hours"
                  icon="🍫"
                  val1={suryaBlockHours}
                  val2={gomathiBlockHours}
                  unit="hrs"
                  decimals={1}
                  delay={0.55}
                />
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* Comparison Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-3xl border border-stone-200/80 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 p-6 sm:p-8 text-white shadow-lg"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-200 backdrop-blur-md mb-2 border border-white/10">
              📊 Side-by-Side Comparison
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Habit & Streak Leaderboard
            </h2>
            <p className="mt-1 text-sm text-stone-300 max-w-lg">
              Visually comparing daily study activity and streaks between Surya and Gomathi over the last 6 months.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Total Combined Team Hours */}
            <div className="rounded-2xl bg-white/10 px-5 py-3 backdrop-blur-md border border-white/10 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-200">
                Combined Hours
              </p>
              <p className="text-xl font-black text-white">
                <AnimatedCounter value={totalTeamHours} decimals={1} suffix=" hrs" />
              </p>
            </div>

            {/* Streak Leader */}
            {leader && maxStreak > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-amber-400/20 px-5 py-3 backdrop-blur-md border border-amber-300/30">
                <Avatar name={(leader as User).name} src={(leader as User).profilePicture} size="sm" showStatus isOnline={isOnline((leader as User).id)} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    Streak Leader 🔥
                  </p>
                  <p className="text-sm font-black text-amber-100">
                    {(leader as User).name} ({maxStreak} {maxStreak === 1 ? 'day' : 'days'})
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Side-by-side Streak Calendars */}
      <div className="grid grid-cols-1 gap-8">
        {streaks.map((streakData, idx) => (
          <motion.div
            key={streakData.user.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <StreakCalendar data={streakData} isOnline={isOnline(streakData.user.id)} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
