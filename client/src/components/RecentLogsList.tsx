import React from 'react';
import { motion } from 'framer-motion';
import type { DailyLog } from '@streaktrack/shared';

interface RecentLogsListProps {
  logs: DailyLog[];
  onSelectLogForEdit?: (log: DailyLog) => void;
}

export const RecentLogsList: React.FC<RecentLogsListProps> = React.memo(({ logs, onSelectLogForEdit }) => {
  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD cleanly
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = getTodayString();

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Recent Entries</h2>
        <span className="text-xs font-semibold text-slate-400">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'} total
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-500">
            No entries logged yet. Fill out the form above to record today's progress!
          </p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
          {logs.map((log, index) => {
            const isToday = log.date === todayStr;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`group rounded-2xl border p-5 transition-all ${
                  isToday
                    ? 'border-indigo-200 bg-indigo-50/30 shadow-xs'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold tracking-wide uppercase text-slate-700">
                      {formatDate(log.date)}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      <span>⏱️</span> {log.hoursSpent} {log.hoursSpent === 1 ? 'hr' : 'hrs'}
                    </span>

                    {isToday && onSelectLogForEdit && (
                      <button
                        onClick={() => onSelectLogForEdit(log)}
                        className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {log.topicsStudied}
                  </p>
                  {log.notes && (
                    <p className="mt-2 text-xs text-slate-600 bg-slate-50/80 rounded-xl p-3 border border-slate-100 italic">
                      "{log.notes}"
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
});

