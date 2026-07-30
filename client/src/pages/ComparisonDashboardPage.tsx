import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { StreakResponse, User, LogUpdatedPayload } from '@streaktrack/shared';
import { API_ROUTES, SOCKET_EVENTS } from '@streaktrack/shared';
import { StreakCalendar } from '../components/StreakCalendar';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api.js';

export const ComparisonDashboardPage: React.FC = () => {
  const { socket, isOnline } = useSocket();
  const [streaks, setStreaks] = useState<StreakResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllStreaks = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch users list
      const usersRes = await fetch(getApiUrl(API_ROUTES.USERS), { credentials: 'include' });
      if (!usersRes.ok) throw new Error('Failed to load users');
      const usersData = await usersRes.json();
      const usersList: User[] = usersData.users || [];

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

  return (
    <div className="space-y-8">
      {/* Comparison Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
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
