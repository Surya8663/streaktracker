import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { API_ROUTES, SOCKET_EVENTS } from '@streaktrack/shared';
import type { MilestoneResponse, Milestone, LogUpdatedPayload, MilestoneWonPayload } from '@streaktrack/shared';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api.js';

export const MilestonesPage: React.FC = () => {
  const { user } = useAuth();
  const { socket, isOnline } = useSocket();
  const [data, setData] = useState<MilestoneResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl(API_ROUTES.MILESTONES), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load milestones');
      const milestoneData: MilestoneResponse = await res.json();
      setData(milestoneData);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load milestone data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  // Listen to socket log update & milestone completed events
  useEffect(() => {
    if (!socket) return;

    const handleLogUpdate = (_payload: LogUpdatedPayload) => {
      fetchMilestones();
    };

    const handleMilestoneCompleted = (payload: MilestoneWonPayload) => {
      fetchMilestones();
      if (user && payload.milestone.winnerId === user.id) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    };

    socket.on(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
    socket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_UPDATED, handleLogUpdate);
      socket.off(SOCKET_EVENTS.MILESTONE_COMPLETED, handleMilestoneCompleted);
    };
  }, [socket, fetchMilestones, user]);

  const triggerTestConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Calculating 5-day milestones...</p>
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

  const milestones = data?.milestones || [];
  const currentBlock = data?.currentBlock;
  const treatScoreboard = data?.treatScoreboard || [];

  const currentUserTreatsOwed = user
    ? treatScoreboard.find((t) => t.userId === user.id)?.treatsOwed || 0
    : 0;

  const otherUserScore = user
    ? treatScoreboard.find((t) => t.userId !== user.id)
    : null;

  return (
    <div className="space-y-8">
      {/* Treat Scoreboard Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 text-white shadow-lg"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-amber-100">
                🏆 Healthy Competition Scoreboard
              </span>
              <button
                onClick={triggerTestConfetti}
                className="cursor-pointer rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white transition-all hover:bg-white/30"
              >
                🎉 Confetti Test
              </button>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              5-Day Block Milestones & Treats 🍫
            </h2>
            <p className="mt-1 text-sm text-amber-100 max-w-lg">
              Every 5 days, study hours are compared. The block winner earns bragging rights + a treat owed by the other!
            </p>
          </div>

          {/* Treat Totals Summary Pills */}
          <div className="flex flex-wrap items-center gap-4">
            {treatScoreboard.map((score) => {
              const isCurrentUser = user?.id === score.userId;
              return (
                <div
                  key={score.userId}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                    isCurrentUser && score.treatsOwed > 0
                      ? 'bg-amber-950/30 border-amber-300/40'
                      : 'bg-white/15 border-white/20'
                  }`}
                >
                  <Avatar
                    name={score.userName}
                    src={score.userName === 'Surya' ? '/avatars/surya.jpg' : '/avatars/gomathi.jpg'}
                    size="sm"
                    showStatus
                    isOnline={isOnline(score.userId)}
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100">
                      {score.userName} {isCurrentUser ? '(You)' : ''}
                    </p>
                    <p className="text-sm font-black text-white">
                      Owes {score.treatsOwed} {score.treatsOwed === 1 ? 'Treat 🍫' : 'Treats 🍫'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Current In-Progress Block Card */}
      {currentBlock && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-3xl border border-indigo-200/80 bg-indigo-50/50 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                  Block #{currentBlock.blockNumber} — In Progress 🔄
                </span>
                <span className="text-xs text-indigo-700 font-semibold">
                  {currentBlock.startDate} to {currentBlock.endDate}
                </span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-indigo-950">
                Current 5-Day Sprint
              </h3>
            </div>

            <div className="rounded-xl bg-white border border-indigo-200 px-4 py-2 text-right shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Time Remaining
              </p>
              <p className="text-sm font-extrabold text-indigo-950">
                {currentBlock.daysRemaining} {currentBlock.daysRemaining === 1 ? 'day left' : 'days left'}
              </p>
            </div>
          </div>

          {/* User Progress Comparison Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* User 1 (Surya) */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={currentBlock.user1Name} src="/avatars/surya.jpg" size="sm" showStatus isOnline={isOnline(currentBlock.user1Id)} />
                  <span className="font-bold text-slate-900">{currentBlock.user1Name}</span>
                </div>
                <span className="text-lg font-black text-indigo-600">
                  {currentBlock.user1Hours.toFixed(1)} hrs
                </span>
              </div>
              {/* Progress visual */}
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (currentBlock.user1Hours / Math.max(1, currentBlock.user1Hours, currentBlock.user2Hours)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* User 2 (Gomathi) */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={currentBlock.user2Name} src="/avatars/gomathi.jpg" size="sm" showStatus isOnline={isOnline(currentBlock.user2Id)} />
                  <span className="font-bold text-slate-900">{currentBlock.user2Name}</span>
                </div>
                <span className="text-lg font-black text-purple-600">
                  {currentBlock.user2Hours.toFixed(1)} hrs
                </span>
              </div>
              {/* Progress visual */}
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (currentBlock.user2Hours / Math.max(1, currentBlock.user1Hours, currentBlock.user2Hours)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Timeline of Completed Blocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            Completed 5-Day Blocks ({milestones.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Most recent blocks first
          </span>
        </div>

        {milestones.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 font-medium">
            No 5-day blocks have completed yet. Keep logging study hours to complete Block #1!
          </div>
        ) : (
          <div className="space-y-4">
            {milestones
              .slice()
              .reverse()
              .map((milestone, idx) => {
                const winnerPhoto =
                  milestone.winnerName === 'Surya' ? '/avatars/surya.jpg' : '/avatars/gomathi.jpg';

                return (
                  <motion.div
                    key={milestone.blockNumber}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className={`rounded-3xl border p-6 transition-all shadow-xs hover:shadow-md ${
                      milestone.isTie
                        ? 'border-slate-200 bg-white'
                        : 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 via-white to-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Block Info & Winner Badge */}
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-extrabold text-white text-base shadow-xs">
                          #{milestone.blockNumber}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              {milestone.startDate} to {milestone.endDate}
                            </span>
                            {milestone.isTie ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">
                                🤝 Draw — No treat owed
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-200">
                                🏆 {milestone.winnerName} won block #{milestone.blockNumber}!
                              </span>
                            )}
                          </div>

                          {!milestone.isTie && milestone.loserName && (
                            <p className="mt-1 text-xs font-semibold text-amber-800">
                              🍫 {milestone.loserName} owes {milestone.winnerName} a treat!
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Hours breakdown */}
                      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200/60 px-4 py-2.5">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-800">
                            {milestone.user1Name}
                          </p>
                          <p className="text-sm font-extrabold text-indigo-600">
                            {milestone.user1Hours.toFixed(1)} hrs
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">vs</span>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800">
                            {milestone.user2Name}
                          </p>
                          <p className="text-sm font-extrabold text-purple-600">
                            {milestone.user2Hours.toFixed(1)} hrs
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
