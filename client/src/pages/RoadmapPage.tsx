import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_ROUTES } from '@streaktrack/shared';
import type { RoadmapResponse, RoadmapPhase } from '@streaktrack/shared';

export const RoadmapPage: React.FC = () => {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<RoadmapPhase | null>(null);

  // Form fields for editing
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ROUTES.ROADMAP, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load placement roadmap');
      const roadmapData: RoadmapResponse = await res.json();
      setData(roadmapData);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load placement roadmap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  const openEditModal = (phase: RoadmapPhase) => {
    setEditingPhase(phase);
    setEditTitle(phase.title);
    setEditSubtitle(phase.subtitle);
    setEditHours(String(phase.targetHours));
    setEditIcon(phase.icon);
  };

  const handleSavePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhase) return;

    try {
      setSaving(true);
      const res = await fetch(`${API_ROUTES.ROADMAP}/phases/${editingPhase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          subtitle: editSubtitle,
          targetHours: Number(editHours),
          icon: editIcon,
        }),
      });

      if (!res.ok) throw new Error('Failed to update phase');

      setEditingPhase(null);
      fetchRoadmap();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating phase');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading 6-Month Placement Roadmap...</p>
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

  const phases = data?.phases || [];
  const progress = data?.overallProgress || {
    daysElapsed: 1,
    totalDays: 180,
    percentDays: 1,
    totalHoursLogged: 0,
    startDate: '',
    targetEndDate: '',
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Overall Placement Progress */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 sm:p-8 text-white shadow-xl"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-indigo-300 backdrop-blur-md mb-2 border border-white/10">
              🎓 6-Month Placement Season Countdown
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {progress.percentDays}% of the way to Placement Season
            </h2>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Day {progress.daysElapsed} of {progress.totalDays} • {progress.totalHoursLogged.toFixed(1)} combined study hours logged
            </p>
          </div>

          {/* Start/End Date Badges */}
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 border border-white/10 backdrop-blur-md text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Started</p>
              <p className="text-sm font-extrabold text-white">{progress.startDate}</p>
            </div>
            <div className="rounded-2xl bg-amber-400/20 px-4 py-3 border border-amber-300/30 backdrop-blur-md text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Target Season</p>
              <p className="text-sm font-extrabold text-amber-100">{progress.targetEndDate}</p>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-200 mb-2">
            <span>Progress: {progress.daysElapsed} / 180 Days</span>
            <span>{180 - progress.daysElapsed} Days Remaining</span>
          </div>
          <div className="h-3.5 w-full rounded-full bg-slate-800/80 p-0.5 border border-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentDays}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 shadow-[0_0_12px_rgba(129,140,248,0.8)]"
            />
          </div>
        </div>
      </motion.div>

      {/* Horizontal Timeline Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm overflow-x-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Roadmap Timeline Nodes</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Nodes illuminate as phase dates pass and hours targets are met
            </p>
          </div>
          <span className="text-xs font-semibold rounded-full bg-slate-100 px-3 py-1 text-slate-600 border border-slate-200">
            180 Days • 5 Phases
          </span>
        </div>

        {/* Timeline Bar with Nodes */}
        <div className="relative min-w-[760px] px-8 py-6">
          {/* Background Connector Track */}
          <div className="absolute top-1/2 left-12 right-12 h-2.5 -translate-y-1/2 rounded-full bg-slate-100 border border-slate-200/60" />

          {/* Animated Filled Progress Connector */}
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(92, Math.max(5, progress.percentDays))}%` }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute top-1/2 left-12 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 shadow-xs"
          />

          {/* Node items flex container */}
          <div className="relative z-10 flex items-center justify-between">
            {phases.map((phase, idx) => {
              return (
                <div key={phase.id} className="flex flex-col items-center group cursor-pointer" onClick={() => openEditModal(phase)}>
                  {/* Phase Node Badge Bubble */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.15 }}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl shadow-md transition-all group-hover:scale-110 ${
                      phase.isCompleted
                        ? 'border-emerald-500 bg-emerald-500 text-white ring-4 ring-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        : phase.isUnlocked
                        ? 'border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                        : 'border-slate-300 bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span>{phase.icon}</span>
                  </motion.div>

                  {/* Node Label */}
                  <div className="mt-3 text-center max-w-[120px]">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider mb-1 ${
                      phase.isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : phase.isUnlocked
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      Phase #{phase.phaseNumber}
                    </span>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1 leading-tight">
                      {phase.title}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Days {phase.startDay}–{phase.endDay}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* End Goal Marker: MNC Offer */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-400 bg-gradient-to-tr from-amber-500 to-yellow-400 text-3xl shadow-lg ring-4 ring-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse"
              >
                🎯
              </motion.div>

              <div className="mt-3 text-center">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300">
                  FINAL GOAL
                </span>
                <p className="text-xs font-black text-amber-950 mt-1 leading-tight">
                  MNC Offer 💼
                </p>
                <p className="text-[10px] text-amber-800 font-semibold">
                  Placement Season
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Editable Phase Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Roadmap Phase Details</h3>
          <span className="text-xs text-slate-500 font-medium">
            Click any phase to edit titles, target hours, or icons
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phases.map((phase, idx) => (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.08 }}
              className={`relative flex flex-col justify-between rounded-3xl border p-6 shadow-xs transition-all hover:shadow-md ${
                phase.isCompleted
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : phase.isUnlocked
                  ? 'border-indigo-200 bg-white'
                  : 'border-slate-200 bg-slate-50/60 opacity-85'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-2xl border border-slate-200">
                      {phase.icon}
                    </span>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        Phase #{phase.phaseNumber} • Days {phase.startDay}–{phase.endDay}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 leading-tight">
                        {phase.title}
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(phase)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-2xs hover:bg-slate-100 hover:text-slate-900"
                    title="Edit Phase"
                  >
                    ✏️
                  </button>
                </div>

                <p className="text-xs text-slate-600 mb-4 line-clamp-2">
                  {phase.subtitle}
                </p>
              </div>

              {/* Progress Bar & Hours Stat */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Hours Logged</span>
                  <span className="text-indigo-600 font-bold">
                    {phase.actualHours.toFixed(1)} / {phase.targetHours} hrs ({phase.percentComplete}%)
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      phase.isCompleted
                        ? 'bg-emerald-500'
                        : phase.isUnlocked
                        ? 'bg-indigo-600'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, phase.percentComplete)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Edit Phase Modal */}
      <AnimatePresence>
        {editingPhase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Edit Phase #{editingPhase.phaseNumber}
                </h3>
                <button
                  onClick={() => setEditingPhase(null)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePhase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Phase Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    placeholder="🚀"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Phase Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Phase Description / Subtitle
                  </label>
                  <textarea
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Target Study Hours
                  </label>
                  <input
                    type="number"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    min={1}
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPhase(null)}
                    className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
