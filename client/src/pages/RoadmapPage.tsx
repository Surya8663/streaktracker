import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/Avatar';
import { API_ROUTES, SOCKET_EVENTS } from '@streaktrack/shared';
import type {
  Month1RoadmapResponse,
  RoadmapDay,
  RoadmapTask,
  TaskCategory,
  UserProgressSummary,
  RoadmapUpdatedPayload,
  RoadmapSource,
  RoadmapSourceLink,
} from '@streaktrack/shared';
import { getApiUrl } from '../utils/api.js';

type TabView = 'journey' | 'sources' | 'DSA' | 'LeetCode' | 'Python' | 'System Design' | 'AI Engineer';

const CATEGORIES: TaskCategory[] = ['DSA', 'LeetCode', 'Python', 'System Design', 'AI Engineer'];

const CAT_CONFIG: Record<TaskCategory, { icon: string; color: string; glow: string; ring: string; badge: string; text: string }> = {
  DSA: {
    icon: '💻',
    color: 'from-violet-600 to-purple-600',
    glow: 'shadow-violet-500/30',
    ring: 'border-violet-500/50',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    text: 'text-violet-400',
  },
  LeetCode: {
    icon: '🧩',
    color: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/30',
    ring: 'border-amber-500/50',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    text: 'text-amber-400',
  },
  Python: {
    icon: '🐍',
    color: 'from-emerald-600 to-teal-600',
    glow: 'shadow-emerald-500/30',
    ring: 'border-emerald-500/50',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-400',
  },
  'System Design': {
    icon: '🏗️',
    color: 'from-sky-600 to-cyan-600',
    glow: 'shadow-sky-500/30',
    ring: 'border-sky-500/50',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    text: 'text-sky-400',
  },
  'AI Engineer': {
    icon: '🤖',
    color: 'from-fuchsia-600 to-pink-600',
    glow: 'shadow-fuchsia-500/30',
    ring: 'border-fuchsia-500/50',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    text: 'text-fuchsia-400',
  },
};

// SVG Circular Progress Ring
const ProgressRing: React.FC<{ pct: number; color: string; size?: number; stroke?: number }> = ({
  pct,
  color,
  size = 72,
  stroke = 6,
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
};

const GlassModal: React.FC<{ children: React.ReactNode; onClose: () => void; maxW?: string }> = ({
  children,
  onClose,
  maxW = 'max-w-xl',
}) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`w-full ${maxW} rounded-t-3xl sm:rounded-3xl bg-[#0e1117] border border-white/[0.09] shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col`}
    >
      {children}
    </motion.div>
  </motion.div>
);

const ConfirmDeleteModal: React.FC<{
  title: string;
  desc: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, desc, onCancel, onConfirm }) => (
  <GlassModal onClose={onCancel} maxW="max-w-sm">
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 text-xl border border-rose-500/25">
          ⚠️
        </span>
        <div>
          <h3 className="text-sm font-black text-white">{title}</h3>
          <p className="text-xs text-slate-400 font-medium">{desc}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-5 py-2 shadow-md transition-colors cursor-pointer">
          Delete
        </button>
      </div>
    </div>
  </GlassModal>
);

export const RoadmapPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const shouldReduceMotion = useReducedMotion();

  const [roadmapData, setRoadmapData] = useState<Month1RoadmapResponse | null>(null);
  const [sourcesData, setSourcesData] = useState<RoadmapSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('journey');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  // Task CRUD
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [formDay, setFormDay] = useState<number>(1);
  const [formCategory, setFormCategory] = useState<TaskCategory>('DSA');
  const [formTitle, setFormTitle] = useState('');
  const [formMins, setFormMins] = useState<number>(30);
  const [formSort, setFormSort] = useState<number>(1);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Session form
  const [sessionMins, setSessionMins] = useState('60');
  const [sessionNotes, setSessionNotes] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Source Vault
  const [sourceGroupModalOpen, setSourceGroupModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<RoadmapSourceLink | null>(null);
  const [selectedSourceIdForLink, setSelectedSourceIdForLink] = useState<number | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<number | null>(null);
  const [sourceGroupCategory, setSourceGroupCategory] = useState<TaskCategory>('DSA');
  const [sourceGroupName, setSourceGroupName] = useState('');
  const [isSubmittingSourceGroup, setIsSubmittingSourceGroup] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const tabScrollRef = useRef<HTMLDivElement>(null);

  const fetchRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_MONTH1), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load Month 1 Roadmap');
      const data: Month1RoadmapResponse = await res.json();
      setRoadmapData(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_SOURCES), { credentials: 'include' });
      if (res.ok) setSourcesData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchRoadmap();
    fetchSources();
  }, [fetchRoadmap, fetchSources]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdated = (_payload: RoadmapUpdatedPayload) => {
      fetchRoadmap();
      fetchSources();
    };
    socket.on(SOCKET_EVENTS.ROADMAP_UPDATED, handleUpdated);
    return () => { socket.off(SOCKET_EVENTS.ROADMAP_UPDATED, handleUpdated); };
  }, [socket, fetchRoadmap, fetchSources]);

  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${taskId}/progress`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !currentCompleted }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update progress');
      toast.success(!currentCompleted ? '✅ Task completed!' : 'Task unmarked');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleStartRoadmap = async () => {
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_MONTH1}/start`), { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to start roadmap');
      toast.success('🚀 Day 1 Sprint Unlocked!');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleSaveDaySession = async (dayNumber: number) => {
    const mins = parseInt(sessionMins, 10);
    if (isNaN(mins) || mins <= 0) { toast.error('Enter valid minutes'); return; }
    try {
      setSavingSession(true);
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_MONTH1}/days/${dayNumber}/save`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutesStudied: mins, notes: sessionNotes.trim() || undefined }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to save day' }));
        throw new Error(errData.message || 'Failed to save day');
      }
      toast.success(`🔥 Day ${dayNumber} saved & synced!`);
      setSessionNotes('');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSavingSession(false);
    }
  };

  const openCreateTaskModal = (defaultDay?: number, defaultCat?: TaskCategory) => {
    setEditingTask(null);
    setFormDay(defaultDay || 1);
    setFormCategory(defaultCat || 'DSA');
    setFormTitle('');
    setFormMins(30);
    setFormSort(1);
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (task: RoadmapTask) => {
    setEditingTask(task);
    setFormDay(task.dayNumber);
    setFormCategory(task.category);
    setFormTitle(task.title);
    setFormMins(task.recommendedMinutes);
    setFormSort(task.sortOrder);
    setTaskModalOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { toast.error('Title required'); return; }
    try {
      setIsSubmittingTask(true);
      const url = editingTask
        ? getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${editingTask.id}`)
        : getApiUrl(API_ROUTES.ROADMAP_TASKS);
      const method = editingTask ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayNumber: formDay, category: formCategory, title: formTitle.trim(), recommendedMinutes: formMins, sortOrder: formSort }),
        credentials: 'include',
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ message: 'Error' })); throw new Error(e.message); }
      toast.success(editingTask ? '✨ Task updated!' : '🚀 Task added!');
      setTaskModalOpen(false);
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${deletingTaskId}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete task');
      toast.success('Task removed');
      setDeletingTaskId(null);
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const openAddLinkModal = (sourceId: number) => {
    setSelectedSourceIdForLink(sourceId);
    setEditingLink(null);
    setLinkTitle(''); setLinkUrl(''); setLinkNote('');
    setLinkModalOpen(true);
  };

  const openEditLinkModal = (link: RoadmapSourceLink) => {
    setSelectedSourceIdForLink(link.sourceId);
    setEditingLink(link);
    setLinkTitle(link.title); setLinkUrl(link.url); setLinkNote(link.note || '');
    setLinkModalOpen(true);
  };

  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim()) { toast.error('Title required'); return; }
    const url = linkUrl.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    try {
      setIsSubmittingLink(true);
      let res: Response;
      if (editingLink) {
        res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP}/source-links/${editingLink.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: linkTitle.trim(), url, note: linkNote.trim() || undefined }),
          credentials: 'include',
        });
      } else if (selectedSourceIdForLink) {
        res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_SOURCES}/${selectedSourceIdForLink}/links`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: linkTitle.trim(), url, note: linkNote.trim() || undefined }),
          credentials: 'include',
        });
      } else return;
      if (!res.ok) { const e = await res.json().catch(() => ({ message: 'Error' })); throw new Error(e.message); }
      toast.success(editingLink ? '✏️ Link updated!' : '🔗 Link saved to vault!');
      setLinkModalOpen(false);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!deletingLinkId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP}/source-links/${deletingLinkId}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete link');
      toast.success('Link removed');
      setDeletingLinkId(null);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteSourceGroup = async () => {
    if (!deletingSourceId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_SOURCES}/${deletingSourceId}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete source');
      toast.success('Source group removed');
      setDeletingSourceId(null);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCreateSourceGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceGroupName.trim()) { toast.error('Name required'); return; }
    try {
      setIsSubmittingSourceGroup(true);
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_SOURCES), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: sourceGroupCategory, name: sourceGroupName.trim() }),
        credentials: 'include',
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ message: 'Error' })); throw new Error(e.message); }
      toast.success('📚 Source group added!');
      setSourceGroupModalOpen(false);
      setSourceGroupName('');
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsSubmittingSourceGroup(false);
    }
  };

  const filteredDays = useMemo(() => {
    const days = roadmapData?.days || [];
    return selectedWeek === 0 ? days : days.filter((d) => d.weekNumber === selectedWeek);
  }, [roadmapData, selectedWeek]);

  const selectedDayData = useMemo(() => {
    if (!selectedDayNum || !roadmapData) return null;
    return roadmapData.days.find((d: RoadmapDay) => d.dayNumber === selectedDayNum) || null;
  }, [roadmapData, selectedDayNum]);

  const categoryTasksByDay = useMemo(() => {
    if (!roadmapData || activeTab === 'journey' || activeTab === 'sources') return [];
    const category = activeTab as TaskCategory;
    const dayMap = new Map<number, { dayNumber: number; weekNumber: number; tasks: RoadmapTask[]; isUnlocked: boolean }>();
    for (const day of roadmapData.days) {
      const catTasks = day.tasks.filter((t: RoadmapTask) => t.category === category);
      if (catTasks.length > 0) dayMap.set(day.dayNumber, { dayNumber: day.dayNumber, weekNumber: day.weekNumber, tasks: catTasks, isUnlocked: day.isUnlocked });
    }
    return Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [roadmapData, activeTab]);

  const sourcesByCategory = useMemo(() => {
    const map = new Map<TaskCategory, RoadmapSource[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const s of sourcesData) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [sourcesData]);

  const myProgress = roadmapData?.myProgress;
  const partnerProgress = roadmapData?.partnerProgress;

  const tabItems: { id: TabView; label: string; icon: string; activeClass: string }[] = [
    { id: 'journey', label: '30-Day Journey', icon: '🗺️', activeClass: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25' },
    { id: 'sources', label: 'Source Vault', icon: '📚', activeClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25' },
    ...CATEGORIES.map((cat) => ({
      id: cat as TabView,
      label: cat,
      icon: CAT_CONFIG[cat].icon,
      activeClass: `bg-gradient-to-r ${CAT_CONFIG[cat].color} text-white shadow-lg ${CAT_CONFIG[cat].glow}`,
    })),
  ];

  const pageEnter = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: 'easeOut' } };

  if (loading && !roadmapData) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
          </div>
          <p className="text-sm font-bold text-slate-400 animate-pulse">Loading Command Centre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-16" style={{ background: 'linear-gradient(to bottom, #020817 0%, #0b1120 100%)', minHeight: '100vh', borderRadius: '1.5rem', color: '#e2e8f0' }}>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)' } }} />

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-t-3xl px-6 pt-10 pb-8 sm:px-10">
        {/* Animated Gradient Orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -top-16 right-0 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute -bottom-24 left-1/2 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #a78bfa 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative z-10">
          {/* Badge + Title Row */}
          <motion.div {...pageEnter} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[11px] font-black px-3 py-1 uppercase tracking-wider">
                🧠 AI Engineer & Core CS
              </span>
              <span className="rounded-full bg-white/[0.06] text-slate-400 border border-white/10 text-[11px] font-bold px-3 py-1">
                30-Day Placement Sprint
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Roadmap Command Centre
                </h1>
                <p className="mt-2 text-sm text-slate-400 max-w-2xl font-medium leading-relaxed">
                  Track your 30-day AI Engineer path side-by-side with your study partner. Every task, session and resource in one mission control.
                </p>
              </div>

              {myProgress?.status === 'not_started' && (
                <motion.button
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  onClick={handleStartRoadmap}
                  className="shrink-0 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-xl cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
                >
                  🚀 Start Day 1 Sprint
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* ── Side-by-Side Progress Cards ──────────────────────────────── */}
          {(myProgress || partnerProgress) && (
            <motion.div
              {...pageEnter}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* My Card */}
              {myProgress && (
                <ProgressCard
                  progress={myProgress}
                  label="You"
                  accentColor="#22d3ee"
                  ringColor="rgba(34,211,238,0.7)"
                  borderGradient="linear-gradient(135deg, rgba(34,211,238,0.5), rgba(20,184,166,0.3))"
                  shouldReduceMotion={!!shouldReduceMotion}
                />
              )}
              {/* Partner Card */}
              {partnerProgress && (
                <ProgressCard
                  progress={partnerProgress}
                  label="Partner"
                  accentColor="#f472b6"
                  ringColor="rgba(244,114,182,0.7)"
                  borderGradient="linear-gradient(135deg, rgba(244,114,182,0.5), rgba(167,139,250,0.3))"
                  shouldReduceMotion={!!shouldReduceMotion}
                />
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── NAVIGATION TABS ──────────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 px-4 sm:px-8 py-3" style={{ background: 'rgba(2,8,23,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between gap-4">
          {/* Tab Scroll Area */}
          <div ref={tabScrollRef} className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5 flex-1">
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                    isActive
                      ? tab.activeClass
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSourceGroupModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 px-3 py-2 text-xs font-bold transition-all cursor-pointer"
            >
              <span>📚</span>
              <span>Add Source</span>
            </button>
            <button
              onClick={() => openCreateTaskModal()}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/10 px-3 py-2 text-xs font-bold transition-all cursor-pointer"
            >
              <span>➕</span>
              <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-8">
        <AnimatePresence mode="wait">

          {/* ── 1. 30-Day Journey View ────────────────────────────────── */}
          {activeTab === 'journey' && (
            <motion.div key="journey" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
              {/* Week Filter */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                {[0, 1, 2, 3, 4, 5].map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      selectedWeek === w
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                        : 'bg-white/[0.04] text-slate-500 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-300'
                    }`}
                  >
                    {w === 0 ? 'All 30 Days' : `Week ${w}`}
                  </button>
                ))}
              </div>

              {/* Day Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredDays.map((day: RoadmapDay) => {
                  const isCurrentDay = myProgress?.currentDay === day.dayNumber && myProgress?.status === 'active';
                  const pct = day.totalTasksCount > 0 ? Math.round((day.completedTasksCount / day.totalTasksCount) * 100) : 0;
                  const cats = Array.from(new Set(day.tasks.map((t: RoadmapTask) => t.category))) as TaskCategory[];

                  return (
                    <motion.button
                      key={day.dayNumber}
                      onClick={() => setSelectedDayNum(day.dayNumber)}
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -3 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className={`relative text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                        isCurrentDay
                          ? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_24px_rgba(124,58,237,0.2)]'
                          : day.isCompleted
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : day.isUnlocked
                          ? 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]'
                          : 'border-white/[0.04] bg-white/[0.01] opacity-50'
                      }`}
                    >
                      {/* Current Day Glow Ring */}
                      {isCurrentDay && (
                        <div className="absolute inset-0 rounded-2xl ring-2 ring-violet-500/40 ring-offset-0 pointer-events-none" />
                      )}

                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrentDay ? 'text-violet-400' : 'text-slate-500'}`}>
                            Week {day.weekNumber}
                          </span>
                          <div className={`text-2xl font-black ${isCurrentDay ? 'text-violet-300' : day.isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {day.dayNumber}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {isCurrentDay && <span className="text-sm animate-pulse">🎯</span>}
                          {day.session && <span className="text-sm">🔥</span>}
                          {!day.isUnlocked && <span className="text-sm text-slate-600">🔒</span>}
                          {day.isCompleted && !isCurrentDay && <span className="text-sm">✅</span>}
                        </div>
                      </div>

                      {/* Category Dots */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {cats.map((cat: TaskCategory) => (
                          <span
                            key={cat as string}
                            title={cat as string}
                            className="h-1.5 w-6 rounded-full"
                            style={{ background: `linear-gradient(to right, ${getCatStartColor(cat)}, ${getCatEndColor(cat)})` }}
                          />
                        ))}
                      </div>

                      {/* Task Count */}
                      <p className="text-[10px] font-bold text-slate-500 mb-2">
                        {day.completedTasksCount}/{day.totalTasksCount} tasks
                      </p>

                      {/* Mini Progress Bar */}
                      <div className="h-1 w-full rounded-full overflow-hidden bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: isCurrentDay
                              ? 'linear-gradient(to right, #7c3aed, #4f46e5)'
                              : day.isCompleted
                              ? 'linear-gradient(to right, #10b981, #059669)'
                              : 'linear-gradient(to right, #475569, #334155)',
                          }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── 2. Shared Sources Vault ───────────────────────────────── */}
          {activeTab === 'sources' && (
            <motion.div key="sources" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-8">
              {/* Vault Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))', border: '1px solid rgba(245,158,11,0.3)' }}>
                    📚
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Shared Resource Vault</h2>
                    <p className="text-xs text-slate-400 font-medium">Curated educators & resources for Surya & Gomathi</p>
                  </div>
                </div>
                <button
                  onClick={() => setSourceGroupModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-slate-950 cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 4px 15px rgba(245,158,11,0.3)' }}
                >
                  <span>➕</span>
                  <span>New Educator</span>
                </button>
              </div>

              {/* Categories */}
              {CATEGORIES.map((cat) => {
                const cfg = CAT_CONFIG[cat];
                const sources = sourcesByCategory.get(cat) || [];
                return (
                  <div key={cat} className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                      <span className="text-xl">{cfg.icon}</span>
                      <h3 className="text-base font-black text-white">{cat}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{sources.length} sources</span>
                    </div>

                    {sources.length === 0 ? (
                      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-center text-xs text-slate-600 font-medium">
                        No sources for {cat} yet. Add one!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sources.map((source) => (
                          <div key={source.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] p-4 space-y-3 transition-all group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                {/* Source avatar */}
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white`} style={{ background: `linear-gradient(135deg, ${getCatStartColor(source.category)}, ${getCatEndColor(source.category)})` }}>
                                  {source.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.text}`}>{source.category}</span>
                                  <h4 className="text-sm font-black text-white leading-tight">{source.name}</h4>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openAddLinkModal(source.id)}
                                  className={`rounded-lg px-2 py-1 text-[10px] font-bold border cursor-pointer transition-all ${cfg.badge}`}
                                >
                                  + Link
                                </button>
                                <button
                                  onClick={() => setDeletingSourceId(source.id)}
                                  className="rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 p-1 text-rose-400 text-xs cursor-pointer"
                                  title="Delete source"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* Links */}
                            {source.links.length === 0 ? (
                              <p className="text-[10px] text-slate-600 italic px-1">No links saved yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {source.links.map((link: RoadmapSourceLink) => (
                                  <div key={link.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-1.5 hover:border-white/[0.12] transition-all group/link">
                                    <div className="flex items-start justify-between gap-2">
                                      <a href={link.url} target="_blank" rel="noopener noreferrer" className={`text-xs font-bold flex items-center gap-1.5 hover:underline leading-snug break-all ${cfg.text}`}>
                                        <span>🔗</span>
                                        <span>{link.title}</span>
                                      </a>
                                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity">
                                        <button onClick={() => openEditLinkModal(link)} className="p-1 text-slate-500 hover:text-white text-xs cursor-pointer">✏️</button>
                                        <button onClick={() => setDeletingLinkId(link.id)} className="p-1 text-slate-500 hover:text-rose-400 text-xs cursor-pointer">🗑️</button>
                                      </div>
                                    </div>
                                    {link.note && (
                                      <p className="text-[10px] text-slate-400 font-medium bg-white/[0.04] px-2 py-1 rounded-lg">💡 {link.note}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <Avatar name={link.addedByName} src={link.addedByAvatar} size="sm" />
                                      <span className="text-[10px] text-slate-500">{link.addedByName} · {new Date(link.createdAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* ── 3. Category Views ─────────────────────────────────────── */}
          {activeTab !== 'journey' && activeTab !== 'sources' && (
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
              {/* Category Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: `linear-gradient(135deg, ${getCatStartColor(activeTab as TaskCategory)}33, ${getCatEndColor(activeTab as TaskCategory)}22)`, border: `1px solid ${getCatStartColor(activeTab as TaskCategory)}40` }}
                  >
                    {CAT_CONFIG[activeTab as TaskCategory]?.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">{activeTab} Curriculum</h2>
                    <p className="text-xs text-slate-400">All 30-day shared {activeTab} tasks</p>
                  </div>
                </div>
                <button
                  onClick={() => openCreateTaskModal(1, activeTab as TaskCategory)}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${getCatStartColor(activeTab as TaskCategory)}, ${getCatEndColor(activeTab as TaskCategory)})`, boxShadow: `0 4px 15px ${getCatStartColor(activeTab as TaskCategory)}40` }}
                >
                  ➕ Add {activeTab} Task
                </button>
              </div>

              {categoryTasksByDay.length === 0 ? (
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
                  <p className="text-slate-500 text-sm font-medium">No tasks for {activeTab} yet. Add one to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categoryTasksByDay.map((group) => (
                    <div key={group.dayNumber} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg px-2.5 py-1 text-xs font-black bg-violet-500/15 text-violet-300 border border-violet-500/25">
                            Day {group.dayNumber}
                          </span>
                          <span className="text-xs text-slate-500 font-bold">Week {group.weekNumber}</span>
                        </div>
                        <button onClick={() => openCreateTaskModal(group.dayNumber, activeTab as TaskCategory)} className="text-xs font-bold text-slate-500 hover:text-violet-400 transition-colors cursor-pointer">
                          + Add to Day {group.dayNumber}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {group.tasks.map((task) => {
                          const isChecked = !!task.isCompleted;
                          return (
                            <div
                              key={task.id}
                              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                                isChecked ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleTask(task.id, isChecked)}
                                  className="h-4 w-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className={`text-xs font-bold ${isChecked ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">⏱️ ~{task.recommendedMinutes} min</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => openEditTaskModal(task)} className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white text-xs cursor-pointer transition-all">✏️</button>
                                <button onClick={() => setDeletingTaskId(task.id)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs cursor-pointer transition-all">🗑️</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── DAY DETAIL MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDayData && (
          <GlassModal onClose={() => setSelectedDayNum(null)} maxW="max-w-2xl">
            <div className="overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.07] sticky top-0 z-10" style={{ background: '#0e1117' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 text-[11px] font-black px-3 py-0.5">
                      Day {selectedDayData.dayNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-bold">Week {selectedDayData.weekNumber}</span>
                    {!selectedDayData.isUnlocked && <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">🔒 Locked</span>}
                  </div>
                  <h3 className="text-lg font-black text-white">Day {selectedDayData.dayNumber} Mission Checklist</h3>
                  <p className="text-xs text-slate-400">{selectedDayData.completedTasksCount} / {selectedDayData.totalTasksCount} tasks completed</p>
                </div>
                <button onClick={() => setSelectedDayNum(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer">✕</button>
              </div>

              {/* Task Groups by Category */}
              <div className="px-6 py-5 space-y-4">
                {CATEGORIES.map((cat: TaskCategory) => {
                  const catTasks = selectedDayData.tasks.filter((t: RoadmapTask) => t.category === cat);
                  if (catTasks.length === 0) return null;
                  const cfg = CAT_CONFIG[cat];
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">{cfg.icon}</span>
                        <span className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>{cat}</span>
                      </div>
                      <div className="space-y-2">
                        {catTasks.map((task: RoadmapTask) => {
                          const isChecked = !!task.isCompleted;
                          return (
                            <div
                              key={task.id}
                              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                                isChecked ? 'bg-emerald-500/5 border-emerald-500/25' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleTask(task.id, isChecked)}
                                  disabled={!selectedDayData.isUnlocked}
                                  className="h-4 w-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                                />
                                <div className="min-w-0">
                                  <p className={`text-xs font-bold leading-snug ${isChecked ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">⏱️ ~{task.recommendedMinutes} min</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEditTaskModal(task)} className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 text-xs cursor-pointer transition-all">✏️</button>
                                <button onClick={() => setDeletingTaskId(task.id)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs cursor-pointer transition-all">🗑️</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => { openCreateTaskModal(selectedDayData.dayNumber); setSelectedDayNum(null); }}
                  className="text-xs font-bold text-slate-500 hover:text-violet-400 transition-colors cursor-pointer pt-1"
                >
                  + Add task to Day {selectedDayData.dayNumber}
                </button>
              </div>

              {/* Session Form */}
              {selectedDayData.isUnlocked && (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSaveDaySession(selectedDayData.dayNumber); }}
                  className="px-6 pb-6 pt-4 border-t border-white/[0.07] space-y-4"
                >
                  <h4 className="text-sm font-black text-white">Log Session — Day {selectedDayData.dayNumber}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Minutes Studied *</label>
                      <input
                        type="number" min="1" required value={sessionMins}
                        onChange={(e) => setSessionMins(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Reflection Notes</label>
                      <input
                        type="text" value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder="Key insights, patterns or blockers..."
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all placeholder-slate-600"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setSelectedDayNum(null)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08] transition-colors cursor-pointer">
                      Close
                    </button>
                    <button
                      type="submit" disabled={savingSession}
                      className="rounded-xl px-5 py-2 text-xs font-black text-white shadow-lg cursor-pointer disabled:opacity-50 transition-all"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}
                    >
                      {savingSession ? 'Saving...' : `Save Day ${selectedDayData.dayNumber} 🔥`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </GlassModal>
        )}
      </AnimatePresence>

      {/* ── TASK CRUD MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {taskModalOpen && (
          <GlassModal onClose={() => setTaskModalOpen(false)} maxW="max-w-md">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">{editingTask ? 'Edit Shared Task' : 'Add Shared Task'}</h3>
                <button onClick={() => setTaskModalOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white cursor-pointer transition-colors">✕</button>
              </div>
              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Day (1–30)</label>
                    <input type="number" min="1" max="30" value={formDay} onChange={(e) => setFormDay(parseInt(e.target.value, 10) || 1)} required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Category</label>
                    <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as TaskCategory)} className="w-full rounded-xl border border-white/10 bg-[#0e1117] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all">
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Task Title</label>
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. LeetCode #1: Two Sum" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all placeholder-slate-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Rec. Minutes</label>
                    <input type="number" min="5" value={formMins} onChange={(e) => setFormMins(parseInt(e.target.value, 10) || 30)} required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Sort Order</label>
                    <input type="number" min="1" value={formSort} onChange={(e) => setFormSort(parseInt(e.target.value, 10) || 1)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Editing updates the shared curriculum without affecting individual progress.</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08] cursor-pointer transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingTask} className="rounded-xl px-5 py-2 text-xs font-black text-white disabled:opacity-50 cursor-pointer transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                    {isSubmittingTask ? 'Saving...' : editingTask ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </GlassModal>
        )}
      </AnimatePresence>

      {/* ── SOURCE GROUP MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {sourceGroupModalOpen && (
          <GlassModal onClose={() => setSourceGroupModalOpen(false)} maxW="max-w-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">Add Educator / Source</h3>
                <button onClick={() => setSourceGroupModalOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white cursor-pointer transition-colors">✕</button>
              </div>
              <form onSubmit={handleCreateSourceGroup} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Category</label>
                  <select value={sourceGroupCategory} onChange={(e) => setSourceGroupCategory(e.target.value as TaskCategory)} className="w-full rounded-xl border border-white/10 bg-[#0e1117] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all">
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Educator / Source Name</label>
                  <input type="text" value={sourceGroupName} onChange={(e) => setSourceGroupName(e.target.value)} placeholder="e.g. Hitesh Choudhary" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all placeholder-slate-600" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSourceGroupModalOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08] cursor-pointer transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingSourceGroup} className="rounded-xl px-5 py-2 text-xs font-black text-slate-950 disabled:opacity-50 cursor-pointer" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                    {isSubmittingSourceGroup ? 'Adding...' : 'Add Source'}
                  </button>
                </div>
              </form>
            </div>
          </GlassModal>
        )}
      </AnimatePresence>

      {/* ── LINK MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {linkModalOpen && (
          <GlassModal onClose={() => setLinkModalOpen(false)} maxW="max-w-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">{editingLink ? 'Edit Resource Link' : 'Add Resource Link'}</h3>
                <button onClick={() => setLinkModalOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white cursor-pointer transition-colors">✕</button>
              </div>
              <form onSubmit={handleSubmitLink} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Title *</label>
                  <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="e.g. Striver's A2Z DSA Sheet" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">URL (https://) *</label>
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://youtube.com/..." required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Note (optional)</label>
                  <textarea rows={2} value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="Key topics, why it's good..." className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 transition-all placeholder-slate-600 resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setLinkModalOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08] cursor-pointer transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingLink} className="rounded-xl px-5 py-2 text-xs font-black text-white disabled:opacity-50 cursor-pointer" style={{ background: 'linear-gradient(135deg, #0d9488, #059669)' }}>
                    {isSubmittingLink ? 'Saving...' : editingLink ? 'Update' : 'Save to Vault'}
                  </button>
                </div>
              </form>
            </div>
          </GlassModal>
        )}
      </AnimatePresence>

      {/* ── CONFIRM DELETE MODALS ─────────────────────────────────────── */}
      <AnimatePresence>
        {deletingTaskId && <ConfirmDeleteModal title="Delete Shared Task?" desc="Removes task from both roadmaps." onCancel={() => setDeletingTaskId(null)} onConfirm={handleDeleteTask} />}
      </AnimatePresence>
      <AnimatePresence>
        {deletingLinkId && <ConfirmDeleteModal title="Delete Resource Link?" desc="Removes from shared source vault." onCancel={() => setDeletingLinkId(null)} onConfirm={handleDeleteLink} />}
      </AnimatePresence>
      <AnimatePresence>
        {deletingSourceId && <ConfirmDeleteModal title="Delete Source Group?" desc="Removes this creator and all nested links." onCancel={() => setDeletingSourceId(null)} onConfirm={handleDeleteSourceGroup} />}
      </AnimatePresence>
    </div>
  );
};

// ── Sub-component: Progress Card ──────────────────────────────────────────────
const ProgressCard: React.FC<{
  progress: UserProgressSummary;
  label: string;
  accentColor: string;
  ringColor: string;
  borderGradient: string;
  shouldReduceMotion: boolean;
}> = ({ progress, label, accentColor, ringColor, borderGradient, shouldReduceMotion }) => (
  <motion.div
    whileHover={shouldReduceMotion ? undefined : { scale: 1.02, rotateY: 2 }}
    transition={{ duration: 0.2 }}
    className="relative rounded-2xl p-5 overflow-hidden"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: `0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}
  >
    {/* Gradient top border */}
    <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: borderGradient }} />

    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <Avatar name={progress.userName} src={progress.userAvatar} size="md" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>{label}</p>
          <h3 className="text-base font-black text-white">{progress.userName}</h3>
        </div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black border ${
        progress.status === 'completed'
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : progress.status === 'active'
          ? 'bg-white/[0.06] text-slate-300 border-white/10'
          : 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
      }`}>
        {progress.status === 'completed' ? '🏆 Done' : progress.status === 'active' ? `🎯 Day ${progress.currentDay}` : '⚪ Not Started'}
      </span>
    </div>

    {/* Ring + Stats */}
    <div className="flex items-center gap-5">
      {/* Circular Progress Ring */}
      <div className="relative shrink-0">
        <ProgressRing pct={progress.percentComplete} color={ringColor} size={72} stroke={6} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-white">{progress.percentComplete}%</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-base font-black" style={{ color: accentColor }}>{progress.completedTasksCount}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase">Tasks</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-base font-black text-amber-400">{(progress.totalMinutesStudied / 60).toFixed(1)}h</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase">Studied</p>
        </div>
        <div className="col-span-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Progress</p>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${accentColor}, ${ringColor})` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentComplete}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCatStartColor(cat: TaskCategory): string {
  const map: Record<TaskCategory, string> = {
    DSA: '#7c3aed',
    LeetCode: '#f59e0b',
    Python: '#059669',
    'System Design': '#0284c7',
    'AI Engineer': '#c026d3',
  };
  return map[cat] || '#7c3aed';
}

function getCatEndColor(cat: TaskCategory): string {
  const map: Record<TaskCategory, string> = {
    DSA: '#6366f1',
    LeetCode: '#f97316',
    Python: '#0d9488',
    'System Design': '#06b6d4',
    'AI Engineer': '#db2777',
  };
  return map[cat] || '#6366f1';
}
