import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Month1RoadmapResponse, TaskCategory, RoadmapTask } from '@streaktrack/shared';

interface TodaysMissionCardProps {
  roadmapData: Month1RoadmapResponse | null;
  loading: boolean;
  onStartRoadmap: () => Promise<void>;
  onTaskToggle: (taskId: number, isCompleted: boolean) => Promise<void>;
  onSaveDay: (dayNumber: number, minutesStudied: number, notes?: string) => Promise<void>;
  onOpenRoadmap: () => void;
}

const CATEGORY_COLORS: Record<TaskCategory, { bg: string; text: string; border: string }> = {
  DSA: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  LeetCode: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Python: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'System Design': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'AI Engineer': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

export const TodaysMissionCard: React.FC<TodaysMissionCardProps> = ({
  roadmapData,
  loading,
  onStartRoadmap,
  onTaskToggle,
  onSaveDay,
  onOpenRoadmap,
}) => {
  const [minutesStudied, setMinutesStudied] = useState<string>('60');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Optimistic local completion state for tasks
  const [localCompletedMap, setLocalCompletedMap] = useState<Record<number, boolean>>({});

  const userProfile = roadmapData?.userProfile;
  const currentDayNum = userProfile?.currentDay && userProfile.currentDay > 0 ? userProfile.currentDay : 1;
  const currentDayData = roadmapData?.days?.find((d) => d.dayNumber === currentDayNum);
  const tasks = currentDayData?.tasks || [];

  // Sync local completed map from server props
  useEffect(() => {
    if (tasks.length > 0) {
      const map: Record<number, boolean> = {};
      for (const t of tasks) {
        map[t.id] = !!t.isCompleted;
      }
      setLocalCompletedMap(map);
    }
  }, [tasks]);

  const handleCheckboxChange = async (task: RoadmapTask) => {
    const newStatus = !localCompletedMap[task.id];

    // Optimistic UI update
    setLocalCompletedMap((prev) => ({ ...prev, [task.id]: newStatus }));
    setError(null);

    try {
      await onTaskToggle(task.id, newStatus);
    } catch (err: unknown) {
      // Revert on error
      setLocalCompletedMap((prev) => ({ ...prev, [task.id]: !newStatus }));
      setError(err instanceof Error ? err.message : 'Failed to update task progress');
    }
  };

  const handleStart = async () => {
    try {
      setStarting(true);
      setError(null);
      await onStartRoadmap();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start roadmap');
    } finally {
      setStarting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const checkedCount = Object.values(localCompletedMap).filter(Boolean).length;
    if (checkedCount === 0) {
      setError(`Please check at least one completed concept or problem for Day ${currentDayNum} before saving today's mission.`);
      return;
    }

    const mins = parseInt(minutesStudied, 10);
    if (isNaN(mins) || mins <= 0) {
      setError('Minutes studied must be a positive number greater than 0.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSaveDay(currentDayNum, mins, notes.trim() || undefined);
      setSuccessMsg(`Day ${currentDayNum} saved & streak calendar updated! 🎉`);
      setNotes('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save daily roadmap mission');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !roadmapData) {
    return (
      <div className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-2xs border-t-3 border-t-teal-500 animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 bg-stone-200 rounded-md" />
          <div className="h-6 w-20 bg-teal-100 rounded-full" />
        </div>
        <div className="h-4 w-3/4 bg-stone-100 rounded-md" />
        <div className="space-y-3 pt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full bg-stone-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── 1. Not Started State ─────────────────────────────────────
  if (!userProfile || userProfile.status === 'not_started') {
    return (
      <div className="rounded-3xl border border-stone-200/80 bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-stone-50 p-6 sm:p-8 shadow-2xs border-t-3 border-t-teal-500 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white text-2xl shadow-md">
              🎯
            </div>
            <div>
              <span className="rounded-full bg-teal-100 text-teal-900 border border-teal-200/80 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5">
                Month 1 Curriculum
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Month 1 AI Engineer Roadmap
              </h2>
            </div>
          </div>

          <button
            onClick={onOpenRoadmap}
            className="btn-press cursor-pointer rounded-xl bg-white border border-stone-200/80 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-stone-50 transition-colors"
          >
            🗺️ View Roadmap Command Centre →
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl font-medium">
          Master 30 days of targeted Data Structures & Algorithms, LeetCode problem solving, Python internals, System Design, and AI Engineering. Start Day 1 to unlock your daily mission tasks!
        </p>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-3.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleStart}
            disabled={starting}
            className="btn-press cursor-pointer rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm px-6 py-3.5 shadow-md shadow-teal-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span>🚀</span>
            <span>{starting ? 'Unlocking Day 1...' : 'Start Day 1 Roadmap'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 2. Active / Completed Day State ──────────────────────────
  const checkedTasksCount = Object.values(localCompletedMap).filter(Boolean).length;
  const totalTasksCount = tasks.length;

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-8 shadow-2xs border-t-3 border-t-teal-500 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="rounded-full bg-teal-100 text-teal-900 border border-teal-200 text-xs font-black px-3 py-0.5">
              🎯 Day {currentDayNum} of 30
            </span>
            <span className="rounded-full bg-stone-100 text-slate-600 border border-stone-200 text-xs font-semibold px-2.5 py-0.5">
              Week {Math.ceil(currentDayNum / 7)}
            </span>
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5">
              ✓ {checkedTasksCount} / {totalTasksCount} Tasks Checked
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Today's Mission
          </h2>
        </div>

        <button
          onClick={onOpenRoadmap}
          className="btn-press cursor-pointer rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/80 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span>🚀</span>
          <span>Open Full Roadmap →</span>
        </button>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
              ✓
            </span>
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Task List with Checkboxes */}
      <div className="space-y-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Concepts & LeetCode Problems for Day {currentDayNum}
        </p>

        {tasks.length === 0 ? (
          <div className="rounded-2xl bg-stone-50 border border-stone-200 p-6 text-center text-xs text-slate-500 font-medium">
            No tasks listed for Day {currentDayNum} yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const isChecked = !!localCompletedMap[task.id];
              const colors = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Python;

              return (
                <div
                  key={task.id}
                  onClick={() => handleCheckboxChange(task)}
                  className={`btn-press cursor-pointer flex items-center justify-between gap-3.5 rounded-2xl p-3.5 sm:p-4 border transition-all ${
                    isChecked
                      ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                      : 'bg-stone-50/60 border-stone-200/80 hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by div container click
                      className="h-5 w-5 rounded-md border-stone-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {task.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ⏱️ ~{task.recommendedMinutes} mins
                        </span>
                      </div>
                      <p className={`text-xs sm:text-sm font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-bold shrink-0 ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isChecked ? '✓ Done' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session Minutes & Notes Form */}
      <form onSubmit={handleSave} className="pt-2 border-t border-stone-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Minutes Studied Today <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="1440"
              required
              value={minutesStudied}
              onChange={(e) => setMinutesStudied(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-3 focus:ring-teal-100"
              placeholder="e.g. 60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Reflections / Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-3 focus:ring-teal-100"
              placeholder="Key insights, LeetCode complexities or challenges today..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500 font-medium">
            Saving updates your streak calendar, total hours, and advances your active day.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="btn-press cursor-pointer w-full sm:w-auto rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-6 py-3 shadow-md shadow-teal-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            <span>⚡</span>
            <span>{saving ? 'Saving & Syncing...' : `Save Day ${currentDayNum} & Mark Streak`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
