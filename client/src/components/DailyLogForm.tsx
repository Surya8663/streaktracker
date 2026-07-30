import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailyLog } from '@streaktrack/shared';
import { API_ROUTES } from '@streaktrack/shared';
import { getApiUrl } from '../utils/api.js';

interface DailyLogFormProps {
  todayLog: DailyLog | null;
  onLogSaved: (savedLog: DailyLog) => void;
}

export const DailyLogForm: React.FC<DailyLogFormProps> = ({ todayLog, onLogSaved }) => {
  const [topicsStudied, setTopicsStudied] = useState('');
  const [hoursSpent, setHoursSpent] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form fields when todayLog changes
  useEffect(() => {
    if (todayLog) {
      setTopicsStudied(todayLog.topicsStudied);
      setHoursSpent(String(todayLog.hoursSpent));
      setNotes(todayLog.notes || '');
    } else {
      setTopicsStudied('');
      setHoursSpent('');
      setNotes('');
    }
  }, [todayLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topicsStudied.trim()) {
      setError('Please specify the topics studied.');
      return;
    }

    const hoursNum = parseFloat(hoursSpent);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setError('Hours spent must be a positive number greater than 0.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      let res: Response;
      if (todayLog) {
        res = await fetch(getApiUrl(`${API_ROUTES.LOGS}/${todayLog.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicsStudied: topicsStudied.trim(),
            hoursSpent: hoursNum,
            notes: notes.trim() || undefined,
          }),
          credentials: 'include',
        });
      } else {
        res = await fetch(getApiUrl(API_ROUTES.LOGS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicsStudied: topicsStudied.trim(),
            hoursSpent: hoursNum,
            notes: notes.trim() || undefined,
          }),
          credentials: 'include',
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to save log' }));
        throw new Error(errData.message || 'Failed to save log');
      }

      const data = await res.json();
      onLogSaved(data.log);

      setSuccessMessage(todayLog ? "Today's entry updated!" : "Today's entry logged!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while saving.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayDateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-8 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              {todayLog ? "Edit Today's Entry" : "Log Today's Entry"}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                todayLog
                  ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  : 'bg-teal-50 text-teal-700 border border-teal-200/60'
              }`}
            >
              {todayLog ? 'Edit Mode' : 'New Entry'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{todayDateStr}</p>
        </div>

        {todayLog && (
          <span className="text-xs font-medium text-slate-400">
            Entry ID #{todayLog.id}
          </span>
        )}
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-200/70 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
              ✓
            </span>
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-5 rounded-2xl bg-rose-50 border border-rose-200/70 p-4 text-xs font-medium text-rose-700"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Topics Studied */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Topics Studied <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={topicsStudied}
              onChange={(e) => setTopicsStudied(e.target.value)}
              placeholder="e.g. React 19, Socket.io events, SQLite WAL mode"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
          </div>

          {/* Hours Spent */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Hours Spent <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="24"
              required
              value={hoursSpent}
              onChange={(e) => setHoursSpent(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            Notes / Reflections <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well today? What challenges did you run into?"
            className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100 resize-none"
          />
        </div>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-press cursor-pointer rounded-2xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-200 transition-all hover:bg-teal-700 hover:shadow-lg focus:ring-4 focus:ring-teal-100 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : todayLog
              ? "Update Today's Entry"
              : "Save Today's Entry"}
          </button>
        </div>
      </form>
    </div>
  );
};
