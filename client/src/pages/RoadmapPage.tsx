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
  RoadmapChatMessage,
} from '@streaktrack/shared';
import { getApiUrl } from '../utils/api.js';

type TabView = 'journey' | 'sources' | 'chat' | 'DSA' | 'LeetCode' | 'Python' | 'System Design' | 'AI Engineer';

const CATEGORIES: TaskCategory[] = ['DSA', 'LeetCode', 'Python', 'System Design', 'AI Engineer'];

const CATEGORY_BADGES: Record<TaskCategory, { icon: string; bg: string; text: string; border: string }> = {
  DSA: { icon: '💻', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  LeetCode: { icon: '🧩', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Python: { icon: '🐍', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'System Design': { icon: '🏗️', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  'AI Engineer': { icon: '🤖', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
};

export const RoadmapPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const shouldReduceMotion = useReducedMotion();

  const [roadmapData, setRoadmapData] = useState<Month1RoadmapResponse | null>(null);
  const [sourcesData, setSourcesData] = useState<RoadmapSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('journey');
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = All
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  // Task CRUD Modal states
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);

  // Form states for Task CRUD
  const [formDay, setFormDay] = useState<number>(1);
  const [formCategory, setFormCategory] = useState<TaskCategory>('DSA');
  const [formTitle, setFormTitle] = useState('');
  const [formMins, setFormMins] = useState<number>(30);
  const [formSort, setFormSort] = useState<number>(1);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Session Form state inside Day Detail Modal
  const [sessionMins, setSessionMins] = useState('60');
  const [sessionNotes, setSessionNotes] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Source Vault Modal States
  const [sourceGroupModalOpen, setSourceGroupModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<RoadmapSourceLink | null>(null);
  const [selectedSourceIdForLink, setSelectedSourceIdForLink] = useState<number | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<number | null>(null);

  // Form states for Source Group
  const [sourceGroupCategory, setSourceGroupCategory] = useState<TaskCategory>('DSA');
  const [sourceGroupName, setSourceGroupName] = useState('');
  const [isSubmittingSourceGroup, setIsSubmittingSourceGroup] = useState(false);

  // Form states for Source Link
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  // Study Chat states
  const { isOnline } = useSocket();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [chatMessages, setChatMessages] = useState<RoadmapChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Fetch Month 1 Roadmap Data
  const fetchRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_MONTH1), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load Month 1 Roadmap');
      const data: Month1RoadmapResponse = await res.json();
      setRoadmapData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load roadmap';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Sources Vault Data
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_SOURCES), { credentials: 'include' });
      if (res.ok) {
        const data: RoadmapSource[] = await res.json();
        setSourcesData(data);
      }
    } catch (err) {
      console.error('Failed to load sources', err);
    }
  }, []);

  // Fetch Chat Messages Data
  const fetchChatMessages = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_CHAT), { credentials: 'include' });
      if (res.ok) {
        const data: RoadmapChatMessage[] = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Failed to load chat messages', err);
    }
  }, []);

  useEffect(() => {
    fetchRoadmap();
    fetchSources();
    fetchChatMessages();
  }, [fetchRoadmap, fetchSources, fetchChatMessages]);

  // Listen for Socket.io real-time updates & chat messages
  useEffect(() => {
    if (!socket) return;
    const handleUpdated = (_payload: RoadmapUpdatedPayload) => {
      fetchRoadmap();
      fetchSources();
    };

    const handleChatMessage = (newMsg: RoadmapChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };

    socket.on(SOCKET_EVENTS.ROADMAP_UPDATED, handleUpdated);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);

    return () => {
      socket.off(SOCKET_EVENTS.ROADMAP_UPDATED, handleUpdated);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleChatMessage);
    };
  }, [socket, fetchRoadmap, fetchSources]);

  // Auto scroll to latest chat message
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const textToSend = chatText.trim();
    if (!textToSend) return;

    if (textToSend.length > 1500) {
      toast.error('Message length exceeds 1500 characters limit.');
      return;
    }

    try {
      setSendingChat(true);
      setChatText('');
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_CHAT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to send message' }));
        throw new Error(err.message || 'Failed to send message');
      }

      const data = await res.json();
      if (data.chatMessage) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === data.chatMessage.id)) return prev;
          return [...prev, data.chatMessage];
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingChat(false);
    }
  };

  const handleKeyDownChat = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // Task Progress Toggle
  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    const newStatus = !currentCompleted;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${taskId}/progress`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newStatus }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update task progress');
      toast.success(newStatus ? 'Task completed! 🎉' : 'Task unmarked');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle task');
    }
  };

  // Start Day 1 Roadmap
  const handleStartRoadmap = async () => {
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_MONTH1}/start`), {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to start roadmap');
      toast.success('Month 1 AI Engineer Roadmap Unlocked! Day 1 is live 🚀');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start roadmap');
    }
  };

  // Save Day Session
  const handleSaveDaySession = async (dayNumber: number) => {
    const mins = parseInt(sessionMins, 10);
    if (isNaN(mins) || mins <= 0) {
      toast.error('Please enter a valid positive study time in minutes.');
      return;
    }

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

      toast.success(`Day ${dayNumber} saved & synced to streak calendar! 🔥`);
      setSessionNotes('');
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save day session');
    } finally {
      setSavingSession(false);
    }
  };

  // Open Create / Edit Task Modal
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

  // Submit Task Create / Edit
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Task title is required.');
      return;
    }

    try {
      setIsSubmittingTask(true);
      let res: Response;
      if (editingTask) {
        res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${editingTask.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayNumber: formDay,
            category: formCategory,
            title: formTitle.trim(),
            recommendedMinutes: formMins,
            sortOrder: formSort,
          }),
          credentials: 'include',
        });
      } else {
        res = await fetch(getApiUrl(API_ROUTES.ROADMAP_TASKS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayNumber: formDay,
            category: formCategory,
            title: formTitle.trim(),
            recommendedMinutes: formMins,
            sortOrder: formSort,
          }),
          credentials: 'include',
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to save task' }));
        throw new Error(errData.message || 'Failed to save task');
      }

      toast.success(editingTask ? 'Task updated for both roadmaps! ✨' : 'New shared task added! 🚀');
      setTaskModalOpen(false);
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Delete Task Confirm
  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_TASKS}/${deletingTaskId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      toast.success('Task removed from roadmap');
      setDeletingTaskId(null);
      fetchRoadmap();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  // ── Source Vault Handlers ─────────────────────────────────────
  const handleCreateSourceGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceGroupName.trim()) {
      toast.error('Source group name is required.');
      return;
    }

    try {
      setIsSubmittingSourceGroup(true);
      const res = await fetch(getApiUrl(API_ROUTES.ROADMAP_SOURCES), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: sourceGroupCategory, name: sourceGroupName.trim() }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create source group' }));
        throw new Error(err.message || 'Failed to create source group');
      }

      toast.success('Source group added to vault! 📚');
      setSourceGroupModalOpen(false);
      setSourceGroupName('');
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create source group');
    } finally {
      setIsSubmittingSourceGroup(false);
    }
  };

  const openAddLinkModal = (sourceId: number) => {
    setSelectedSourceIdForLink(sourceId);
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkNote('');
    setLinkModalOpen(true);
  };

  const openEditLinkModal = (link: RoadmapSourceLink) => {
    setSelectedSourceIdForLink(link.sourceId);
    setEditingLink(link);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkNote(link.note || '');
    setLinkModalOpen(true);
  };

  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim()) {
      toast.error('Link title is required.');
      return;
    }

    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
      toast.error('Invalid URL. Link must start with http:// or https://');
      return;
    }

    try {
      setIsSubmittingLink(true);
      let res: Response;

      if (editingLink) {
        res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP}/source-links/${editingLink.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: linkTitle.trim(),
            url: trimmedUrl,
            note: linkNote.trim() || undefined,
          }),
          credentials: 'include',
        });
      } else if (selectedSourceIdForLink) {
        res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_SOURCES}/${selectedSourceIdForLink}/links`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: linkTitle.trim(),
            url: trimmedUrl,
            note: linkNote.trim() || undefined,
          }),
          credentials: 'include',
        });
      } else {
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to save link' }));
        throw new Error(err.message || 'Failed to save link');
      }

      toast.success(editingLink ? 'Link updated! ✏️' : 'Resource link added to vault! 🔗');
      setLinkModalOpen(false);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!deletingLinkId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP}/source-links/${deletingLinkId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete link');
      toast.success('Link removed from source vault');
      setDeletingLinkId(null);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete link');
    }
  };

  const handleDeleteSourceGroup = async () => {
    if (!deletingSourceId) return;
    try {
      const res = await fetch(getApiUrl(`${API_ROUTES.ROADMAP_SOURCES}/${deletingSourceId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete source group');
      toast.success('Source group removed');
      setDeletingSourceId(null);
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete source group');
    }
  };

  // Filtered Days
  const filteredDays = useMemo(() => {
    const days = roadmapData?.days || [];
    if (selectedWeek === 0) return days;
    return days.filter((d) => d.weekNumber === selectedWeek);
  }, [roadmapData, selectedWeek]);

  // Selected Day Data for Modal
  const selectedDayData = useMemo(() => {
    if (!selectedDayNum || !roadmapData) return null;
    return roadmapData.days.find((d) => d.dayNumber === selectedDayNum) || null;
  }, [roadmapData, selectedDayNum]);

  // Group tasks for Category Views
  const categoryTasksByDay = useMemo(() => {
    if (!roadmapData || activeTab === 'journey' || activeTab === 'sources') return [];
    const category = activeTab as TaskCategory;
    const dayMap = new Map<number, { dayNumber: number; weekNumber: number; tasks: RoadmapTask[]; isUnlocked: boolean }>();

    for (const day of roadmapData.days) {
      const catTasks = day.tasks.filter((t) => t.category === category);
      if (catTasks.length > 0) {
        dayMap.set(day.dayNumber, {
          dayNumber: day.dayNumber,
          weekNumber: day.weekNumber,
          tasks: catTasks,
          isUnlocked: day.isUnlocked,
        });
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [roadmapData, activeTab]);

  // Group sources by category for Sources Vault view
  const sourcesByCategory = useMemo(() => {
    const map = new Map<TaskCategory, RoadmapSource[]>();
    for (const cat of CATEGORIES) {
      map.set(cat, []);
    }
    for (const s of sourcesData) {
      if (!map.has(s.category)) {
        map.set(s.category, []);
      }
      map.get(s.category)!.push(s);
    }
    return map;
  }, [sourcesData]);

  const myProgress = roadmapData?.myProgress;
  const partnerProgress = roadmapData?.partnerProgress;

  if (loading && !roadmapData) {
    return (
      <div className="flex min-h-[450px] items-center justify-center bg-slate-950 rounded-3xl border border-slate-800 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
          <p className="text-sm font-bold text-slate-300">Loading AI Engineer Roadmap Command Centre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-slate-100">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      {/* ── Dark Cosmic Hero Banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 shadow-2xl bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Glow Orbs */}
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-black px-3 py-0.5">
                  🧠 AI Engineer & Core CS
                </span>
                <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold px-3 py-0.5">
                  30-Day Placement Sprint
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Roadmap Command Centre ⚡
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-2xl font-medium leading-relaxed">
                Track concepts, LeetCode problems, Python internals, System Design, AI Engineering, and shared source materials side-by-side with your study partner.
              </p>
            </div>

            {myProgress?.status === 'not_started' && (
              <button
                onClick={handleStartRoadmap}
                className="btn-press cursor-pointer rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-400 transition-all shrink-0"
              >
                🚀 Start Day 1 Sprint
              </button>
            )}
          </div>

          {/* ── Side-by-Side Surya vs Gomathi Progress Cards ────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* My Progress Card (Surya/Signed-in) */}
            {myProgress && (
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { rotateY: 2, rotateX: -2, scale: 1.01 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl border border-teal-500/40 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md border-t-3 border-t-teal-400"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={myProgress.userName} src={myProgress.userAvatar} size="md" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-teal-400">
                        {user?.id === myProgress.userId ? 'You (Signed-in)' : myProgress.userName}
                      </span>
                      <h3 className="text-lg font-black text-white">{myProgress.userName}</h3>
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    myProgress.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : myProgress.status === 'active'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {myProgress.status === 'completed'
                      ? '🏆 Finished'
                      : myProgress.status === 'active'
                      ? `🎯 Day ${myProgress.currentDay}`
                      : '⚪ Not Started'}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-teal-400">{myProgress.percentComplete}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Complete</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-white">{myProgress.completedTasksCount} / {myProgress.totalTasksCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tasks Done</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-amber-400">{(myProgress.totalMinutesStudied / 60).toFixed(1)}h</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Study Time</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Month 1 Progress</span>
                    <span className="text-teal-400">{myProgress.percentComplete}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${myProgress.percentComplete}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Partner Progress Card (Gomathi / Other User) */}
            {partnerProgress && (
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { rotateY: -2, rotateX: -2, scale: 1.01 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl border border-purple-500/40 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md border-t-3 border-t-purple-400"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={partnerProgress.userName} src={partnerProgress.userAvatar} size="md" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                        Study Partner
                      </span>
                      <h3 className="text-lg font-black text-white">{partnerProgress.userName}</h3>
                    </div>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    partnerProgress.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : partnerProgress.status === 'active'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {partnerProgress.status === 'completed'
                      ? '🏆 Finished'
                      : partnerProgress.status === 'active'
                      ? `🎯 Day ${partnerProgress.currentDay}`
                      : '⚪ Day 0'}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-purple-400">{partnerProgress.percentComplete}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Complete</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-white">{partnerProgress.completedTasksCount} / {partnerProgress.totalTasksCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tasks Done</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                    <p className="text-lg font-black text-amber-400">{(partnerProgress.totalMinutesStudied / 60).toFixed(1)}h</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Study Time</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Partner Progress</span>
                    <span className="text-purple-400">{partnerProgress.percentComplete}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${partnerProgress.percentComplete}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Command Centre View Navigation Tabs ─────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <nav className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('journey')}
            className={`btn-press cursor-pointer rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
              activeTab === 'journey'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🗺️ 30-Day Journey
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`btn-press cursor-pointer rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
              activeTab === 'sources'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📚 Sources Vault
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`btn-press cursor-pointer rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>💬</span>
            <span>Study Chat</span>
            {partnerProgress && isOnline(partnerProgress.userId) && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {CATEGORIES.map((cat) => {
            const badge = CATEGORY_BADGES[cat];
            const isActive = activeTab === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat as TabView)}
                className={`btn-press cursor-pointer rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-100 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{badge.icon}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSourceGroupModalOpen(true)}
            className="btn-press cursor-pointer rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-extrabold text-xs px-3.5 py-2.5 border border-amber-500/30 transition-all flex items-center gap-1.5"
          >
            <span>📚</span>
            <span>Add Source Group</span>
          </button>

          <button
            onClick={() => openCreateTaskModal()}
            className="btn-press cursor-pointer rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-4 py-2.5 border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* ── 1. 30-Day Journey View ──────────────────────────────────── */}
      {activeTab === 'journey' && (
        <div className="space-y-6">
          {/* Week Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 mr-1">Filter Week:</span>
            {[0, 1, 2, 3, 4, 5].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`btn-press cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedWeek === w
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {w === 0 ? 'All Weeks (30 Days)' : `Week ${w}`}
              </button>
            ))}
          </div>

          {/* 30 Day Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDays.map((day) => {
              const isCurrentDay = myProgress?.currentDay === day.dayNumber && myProgress?.status === 'active';
              const hasSession = !!day.session || day.completedTasksCount > 0;
              const percent = day.totalTasksCount > 0 ? Math.round((day.completedTasksCount / day.totalTasksCount) * 100) : 0;

              return (
                <motion.div
                  key={day.dayNumber}
                  onClick={() => setSelectedDayNum(day.dayNumber)}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
                  transition={{ duration: 0.15 }}
                  className={`btn-press cursor-pointer relative flex flex-col justify-between rounded-2xl p-5 border transition-all ${
                    isCurrentDay
                      ? 'bg-slate-900/90 border-teal-400/80 shadow-[0_0_20px_rgba(20,184,166,0.25)] ring-2 ring-teal-500/50'
                      : day.isCompleted
                      ? 'bg-slate-900/70 border-emerald-500/40'
                      : day.isUnlocked
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-900 opacity-60'
                  }`}
                >
                  <div>
                    {/* Day Header Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-lg px-2.5 py-0.5 text-xs font-black ${
                          isCurrentDay
                            ? 'bg-teal-500 text-slate-950'
                            : day.isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          Day {day.dayNumber}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Week {day.weekNumber}
                        </span>
                      </div>

                      {/* Status Markers */}
                      <div className="flex items-center gap-1.5">
                        {isCurrentDay && (
                          <span className="text-xs font-black text-teal-400 animate-pulse" title="Active Current Day">
                            🎯 Active
                          </span>
                        )}
                        {hasSession && (
                          <span className="text-sm" title="Session Saved 🔥">
                            🔥
                          </span>
                        )}
                        {!day.isUnlocked && (
                          <span className="text-sm text-slate-500" title="Locked Future Day 🔒">
                            🔒
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Task Overview Count */}
                    <div className="space-y-1.5 my-3">
                      <p className="text-xs font-bold text-slate-200">
                        {day.completedTasksCount} / {day.totalTasksCount} Tasks Completed
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.from(new Set(day.tasks.map((t) => t.category))).map((cat) => (
                          <span key={cat} className="text-[9px] font-extrabold bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Day Progress Bar */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>{day.isCompleted ? 'Completed ✓' : day.isUnlocked ? 'Unlocked' : 'Locked'}</span>
                      <span className="text-teal-400">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          day.isCompleted ? 'bg-emerald-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. Shared Sources Vault View ─────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <div>
                <h3 className="text-xl font-black text-white">Shared Resource Vault</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Curated YouTube tutorials, courses, and documentation preloaded for Surya & Gomathi
                </p>
              </div>
            </div>

            <button
              onClick={() => setSourceGroupModalOpen(true)}
              className="btn-press cursor-pointer rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 shadow-md flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>New Educator / Source Group</span>
            </button>
          </div>

          {/* Sources Categorized Cards Grid */}
          <div className="space-y-8">
            {CATEGORIES.map((cat) => {
              const badge = CATEGORY_BADGES[cat];
              const sources = sourcesByCategory.get(cat) || [];

              return (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <span className="text-xl">{badge.icon}</span>
                    <h4 className="text-lg font-black text-white">{cat} Sources</h4>
                    <span className="text-xs font-bold text-slate-400">({sources.length} Groups)</span>
                  </div>

                  {sources.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-center text-xs text-slate-500 font-medium">
                      No sources added for {cat} yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {sources.map((source) => (
                        <div
                          key={source.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-lg flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {source.category}
                                </span>
                                <h5 className="text-base font-black text-white">{source.name}</h5>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openAddLinkModal(source.id)}
                                  className="btn-press cursor-pointer rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 px-2.5 py-1 text-xs font-bold transition-all"
                                >
                                  + Link
                                </button>
                                <button
                                  onClick={() => setDeletingSourceId(source.id)}
                                  className="btn-press cursor-pointer rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 p-1 text-xs"
                                  title="Delete Source Group"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* Saved Links */}
                            <div className="space-y-3">
                              {source.links.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">No links saved under {source.name} yet.</p>
                              ) : (
                                source.links.map((link) => (
                                  <div
                                    key={link.id}
                                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2 hover:border-slate-700 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs sm:text-sm font-bold text-teal-400 hover:underline flex items-center gap-1.5 leading-snug break-all"
                                      >
                                        <span>🔗</span>
                                        <span>{link.title}</span>
                                      </a>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => openEditLinkModal(link)}
                                          className="p-1 text-xs text-slate-400 hover:text-white"
                                          title="Edit Link"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => setDeletingLinkId(link.id)}
                                          className="p-1 text-xs text-rose-400 hover:text-rose-300"
                                          title="Delete Link"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>

                                    {link.note && (
                                      <p className="text-xs text-slate-300 font-medium bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                                        💡 {link.note}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                                      <div className="flex items-center gap-1.5">
                                        <Avatar name={link.addedByName} src={link.addedByAvatar} size="sm" />
                                        <span className="font-bold text-slate-300">{link.addedByName}</span>
                                      </div>
                                      <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Real-time Pair Study Chat View ────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col h-[650px] overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between bg-slate-950 px-6 py-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 text-xl border border-purple-500/30">
                💬
              </div>
              <div>
                <h3 className="text-base font-black text-white">Study Pair Chat</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Direct communication for study tasks, blockers & resource sharing
                </p>
              </div>
            </div>

            {partnerProgress && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-xs font-bold">
                <span className={`h-2.5 w-2.5 rounded-full ${isOnline(partnerProgress.userId) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
                <span className="text-slate-300">{partnerProgress.userName} ({isOnline(partnerProgress.userId) ? 'Online' : 'Offline'})</span>
              </div>
            )}
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-950/40">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-slate-500">
                <span className="text-4xl">💬</span>
                <p className="text-xs font-bold text-slate-400 max-w-sm">
                  No messages yet. Send a message to discuss today's roadmap tasks or blockers with your study partner!
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = user?.id === msg.senderId;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 max-w-[85%] sm:max-w-[70%] ${
                      isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {!isMe && (
                      <Avatar name={msg.senderName} src={msg.senderAvatar} size="sm" />
                    )}

                    <div className="space-y-1 min-w-0">
                      <div className={`flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] font-bold text-slate-400">{msg.senderName}</span>
                        <span className="text-[10px] text-slate-500">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium leading-relaxed break-words shadow-md ${
                          isMe
                            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-tr-xs'
                            : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendChat} className="bg-slate-950 p-4 border-t border-slate-800 shrink-0 space-y-2">
            <div className="relative">
              <textarea
                rows={2}
                maxLength={1500}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={handleKeyDownChat}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
              />

              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500 font-semibold">
                  {chatText.length} / 1500 chars
                </span>

                <button
                  type="submit"
                  disabled={sendingChat || !chatText.trim()}
                  className="btn-press cursor-pointer rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 py-2 shadow-md disabled:opacity-40 flex items-center gap-1.5 transition-all"
                >
                  <span>{sendingChat ? 'Sending...' : 'Send Message'}</span>
                  <span>🚀</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── 4. Category Views (DSA, LeetCode, Python, System Design, AI Engineer) ── */}
      {activeTab !== 'journey' && activeTab !== 'sources' && activeTab !== 'chat' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{CATEGORY_BADGES[activeTab as TaskCategory].icon}</span>
              <div>
                <h3 className="text-lg font-black text-white">{activeTab} Curriculum</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Showing all shared {activeTab} tasks grouped by day
                </p>
              </div>
            </div>

            <button
              onClick={() => openCreateTaskModal(1, activeTab as TaskCategory)}
              className="btn-press cursor-pointer rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-3.5 py-2 shadow-md"
            >
              ➕ Add {activeTab} Task
            </button>
          </div>

          {categoryTasksByDay.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400 font-medium">
              No tasks listed for category {activeTab} yet. Click "Add Task" to create one!
            </div>
          ) : (
            <div className="space-y-6">
              {categoryTasksByDay.map((group) => (
                <div key={group.dayNumber} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-teal-500/20 text-teal-300 text-xs font-black px-2.5 py-0.5">
                        Day {group.dayNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        Week {group.weekNumber}
                      </span>
                    </div>

                    <button
                      onClick={() => openCreateTaskModal(group.dayNumber, activeTab as TaskCategory)}
                      className="text-xs font-bold text-slate-400 hover:text-teal-400 transition-colors"
                    >
                      + Add to Day {group.dayNumber}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {group.tasks.map((task) => {
                      const isChecked = !!task.isCompleted;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all ${
                            isChecked
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-slate-950/50 border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTask(task.id, isChecked)}
                              className="h-5 w-5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className={`text-xs sm:text-sm font-bold truncate ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                                {task.title}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                ⏱️ ~{task.recommendedMinutes} mins
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => openEditTaskModal(task)}
                              className="btn-press cursor-pointer rounded-lg bg-slate-800 hover:bg-slate-700 p-1.5 text-xs text-slate-300 border border-slate-700"
                              title="Edit shared task"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeletingTaskId(task.id)}
                              className="btn-press cursor-pointer rounded-lg bg-rose-950/40 hover:bg-rose-900/60 p-1.5 text-xs text-rose-300 border border-rose-800/50"
                              title="Delete shared task"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Day Detail Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDayData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-teal-500/20 text-teal-300 text-xs font-black px-3 py-0.5 border border-teal-500/30">
                      Day {selectedDayData.dayNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Week {selectedDayData.weekNumber}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">
                    Day {selectedDayData.dayNumber} Mission Checklist
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedDayNum(null)}
                  className="cursor-pointer rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Categorized Task Checklist */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Concepts & Problems ({selectedDayData.completedTasksCount} / {selectedDayData.totalTasksCount} Checked)
                  </p>
                  <button
                    onClick={() => openCreateTaskModal(selectedDayData.dayNumber)}
                    className="text-xs font-bold text-teal-400 hover:underline"
                  >
                    + Add Task to Day {selectedDayData.dayNumber}
                  </button>
                </div>

                {selectedDayData.tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No tasks for Day {selectedDayData.dayNumber}.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedDayData.tasks.map((task) => {
                      const badge = CATEGORY_BADGES[task.category] || CATEGORY_BADGES.Python;
                      const isChecked = !!task.isCompleted;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                            isChecked ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTask(task.id, isChecked)}
                              className="h-5 w-5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {task.category}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  ⏱️ ~{task.recommendedMinutes} mins
                                </span>
                              </div>
                              <p className={`text-xs sm:text-sm font-bold truncate ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                                {task.title}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditTaskModal(task)}
                              className="p-1 text-xs text-slate-400 hover:text-white"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeletingTaskId(task.id)}
                              className="p-1 text-xs text-rose-400 hover:text-rose-300"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Day Session Save Form */}
              {selectedDayData.isUnlocked && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveDaySession(selectedDayData.dayNumber);
                  }}
                  className="pt-4 border-t border-slate-800 space-y-4"
                >
                  <h4 className="text-sm font-bold text-white">Log Study Session for Day {selectedDayData.dayNumber}</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Minutes Studied *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={sessionMins}
                        onChange={(e) => setSessionMins(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Reflection Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-teal-500"
                        placeholder="Key insights or code patterns studied..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDayNum(null)}
                      className="btn-press cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={savingSession}
                      className="btn-press cursor-pointer rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-5 py-2 shadow-md disabled:opacity-50"
                    >
                      {savingSession ? 'Saving...' : `Save Day ${selectedDayData.dayNumber} & Sync Streak 🔥`}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create / Edit Task Modal ────────────────────────────────── */}
      <AnimatePresence>
        {taskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">
                  {editingTask ? 'Edit Shared Task' : 'Add Shared Task'}
                </h3>
                <button
                  onClick={() => setTaskModalOpen(false)}
                  className="cursor-pointer text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Day Number (1–30)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formDay}
                      onChange={(e) => setFormDay(parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as TaskCategory)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Task Title / Concept / LeetCode #</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                    placeholder="e.g. LeetCode #1: Two Sum"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Recommended Minutes</label>
                    <input
                      type="number"
                      min="5"
                      value={formMins}
                      onChange={(e) => setFormMins(parseInt(e.target.value, 10) || 30)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Sort Order</label>
                    <input
                      type="number"
                      min="1"
                      value={formSort}
                      onChange={(e) => setFormSort(parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Note: Editing a shared task updates the curriculum for both users without affecting individual completion states.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTaskModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-5 py-2 shadow-md disabled:opacity-50"
                  >
                    {isSubmittingTask ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create Source Group Modal ───────────────────────────────── */}
      <AnimatePresence>
        {sourceGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">Add New Source Group / Creator</h3>
                <button
                  onClick={() => setSourceGroupModalOpen(false)}
                  className="cursor-pointer text-slate-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSourceGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                  <select
                    value={sourceGroupCategory}
                    onChange={(e) => setSourceGroupCategory(e.target.value as TaskCategory)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-amber-500 outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Educator / Source Group Name</label>
                  <input
                    type="text"
                    value={sourceGroupName}
                    onChange={(e) => setSourceGroupName(e.target.value)}
                    placeholder="e.g. Hitesh Choudhary"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSourceGroupModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSourceGroup}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-5 py-2 shadow-md disabled:opacity-50"
                  >
                    {isSubmittingSourceGroup ? 'Creating...' : 'Add Source Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create / Edit Source Link Modal ─────────────────────────── */}
      <AnimatePresence>
        {linkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">
                  {editingLink ? 'Edit Resource Link' : 'Add Resource Link'}
                </h3>
                <button
                  onClick={() => setLinkModalOpen(false)}
                  className="cursor-pointer text-slate-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Resource Title *</label>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="e.g. Striver's A2Z DSA Sheet / Playlist"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">URL (Must start with http:// or https://) *</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://youtube.com/playlist?list=..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white focus:border-teal-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Optional Note / Key Topics Covered</label>
                  <textarea
                    rows={2}
                    value={linkNote}
                    onChange={(e) => setLinkNote(e.target.value)}
                    placeholder="e.g. Best for binary tree traversals and dynamic programming patterns"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-white focus:border-teal-500 outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLink}
                    className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-5 py-2 shadow-md disabled:opacity-50"
                  >
                    {isSubmittingLink ? 'Saving...' : editingLink ? 'Update Link' : 'Save Link to Vault'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Task Confirmation Modal ─────────────────────────── */}
      <AnimatePresence>
        {deletingTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-rose-900/50 bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 text-xl border border-rose-500/30">
                  ⚠️
                </span>
                <div>
                  <h3 className="text-base font-black text-white">Delete Shared Task?</h3>
                  <p className="text-xs text-slate-400 font-medium">This will remove the task from both roadmaps.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeletingTaskId(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTask}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-5 py-2 shadow-md"
                >
                  Delete Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Source Link Confirmation Modal ────────────────────── */}
      <AnimatePresence>
        {deletingLinkId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-rose-900/50 bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 text-xl border border-rose-500/30">
                  ⚠️
                </span>
                <div>
                  <h3 className="text-base font-black text-white">Delete Resource Link?</h3>
                  <p className="text-xs text-slate-400 font-medium">This link will be removed from the shared source vault.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeletingLinkId(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLink}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-5 py-2 shadow-md"
                >
                  Delete Link
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Source Group Confirmation Modal ───────────────────── */}
      <AnimatePresence>
        {deletingSourceId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-rose-900/50 bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 text-xl border border-rose-500/30">
                  ⚠️
                </span>
                <div>
                  <h3 className="text-base font-black text-white">Delete Source Group?</h3>
                  <p className="text-xs text-slate-400 font-medium">This will remove this creator group and all nested links.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeletingSourceId(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSourceGroup}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-5 py-2 shadow-md"
                >
                  Delete Source Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
