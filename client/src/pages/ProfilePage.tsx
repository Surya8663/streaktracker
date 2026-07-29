import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { API_ROUTES } from '@streaktrack/shared';
import type { ProfileStatsResponse } from '@streaktrack/shared';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export const ProfilePage: React.FC = () => {
  const { user, checkAuth } = useAuth();
  const { isOnline } = useSocket();

  const [profileData, setProfileData] = useState<ProfileStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bio Editing
  const [bio, setBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [bioSavedBanner, setBioSavedBanner] = useState(false);

  // Avatar Uploading
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_ROUTES.PROFILE}/${user.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load profile');
      const data: ProfileStatsResponse = await res.json();
      setProfileData(data);
      setBio(data.user.bio || 'Target: Product-based MNC as SDE 🎯');
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBio(true);
      const res = await fetch(API_ROUTES.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bio }),
      });

      if (!res.ok) throw new Error('Failed to update bio');

      setBioSavedBanner(true);
      setTimeout(() => setBioSavedBanner(false), 3000);
      fetchProfile();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating bio');
    } finally {
      setSavingBio(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setUploadingAvatar(true);
      const res = await fetch(API_ROUTES.UPLOAD_AVATAR, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload profile picture');

      await checkAuth(); // Refresh global auth state with new avatar URL
      fetchProfile();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error uploading avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading && !profileData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading profile & stats...</p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-medium text-rose-700">
        {error || 'Failed to load profile data'}
      </div>
    );
  }

  const u = profileData.user;
  const userOnline = isOnline(u.id);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Main Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Upload Camera Badge */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar name={u.name} src={u.profilePicture} size="xl" showStatus isOnline={userOnline} />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-lg">📷</span>
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/60">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {u.name}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      userOnline
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-slate-500 border border-stone-200'
                    }`}
                  >
                    <span>{userOnline ? '🟢' : '⚪'}</span>
                    {userOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{u.email}</p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="btn-press cursor-pointer rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-stone-100 transition-colors"
              >
                📷 Upload Photo
              </button>
            </div>

            {/* Member since badge */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-stone-100/80 px-3 py-1 text-xs font-semibold text-slate-600 border border-stone-200/60">
              <span>🗓️ Member since {formatDate(u.joinDate)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Editable Goal & About Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-3xl border border-teal-200/80 bg-teal-50/50 p-6 sm:p-8 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h3 className="text-lg font-bold text-teal-950">
              My Placement Goal / About Me
            </h3>
          </div>
          <span className="text-xs font-semibold text-teal-700">Editable Goal</span>
        </div>

        <form onSubmit={handleSaveBio} className="space-y-4">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-teal-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none"
            placeholder="What is your main study goal or target position? (e.g. Target: Product-based MNC as SDE)"
            required
          />

          <div className="flex items-center justify-between">
            {bioSavedBanner ? (
              <span className="text-xs font-bold text-emerald-600">
                ✅ Goal statement updated!
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Keep your goal visible to stay motivated during the 6-month journey.
              </span>
            )}

            <button
              type="submit"
              disabled={savingBio}
              className="btn-press cursor-pointer rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50"
            >
              {savingBio ? 'Saving Goal...' : 'Save Goal Statement'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Lifetime Stats Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Lifetime Study & Streak Stats</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Study Hours */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Study Hours
              </span>
              <span className="text-2xl">⏱️</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.totalHoursLogged} decimals={1} suffix=" hrs" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">All-time study time logged</p>
          </motion.div>

          {/* Days Active */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Days Active
              </span>
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.totalDaysActive} suffix=" Days" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Unique calendar days logged</p>
          </motion.div>

          {/* Current Streak */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="rounded-3xl border border-amber-200/80 bg-amber-50/60 p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Current Streak
              </span>
              <span className="text-2xl animate-float">🔥</span>
            </div>
            <p className="text-3xl font-black text-amber-950">
              <AnimatedCounter value={profileData.currentStreak} suffix={profileData.currentStreak === 1 ? ' Day' : ' Days'} />
            </p>
            <p className="mt-1 text-xs text-amber-800/80 font-medium">Active consecutive study days</p>
          </motion.div>

          {/* Longest Streak */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="rounded-3xl border border-teal-200/80 bg-teal-50/60 p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Longest Streak
              </span>
              <span className="text-2xl">✨</span>
            </div>
            <p className="text-3xl font-black text-teal-950">
              <AnimatedCounter value={profileData.longestStreak} suffix={profileData.longestStreak === 1 ? ' Day' : ' Days'} />
            </p>
            <p className="mt-1 text-xs text-teal-800/80 font-medium">Best consecutive streak record</p>
          </motion.div>

          {/* 5-Day Milestones Won */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            className="rounded-3xl border border-emerald-200/80 bg-emerald-50/60 p-6 shadow-xs sm:col-span-2 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                5-Day Block Milestones Won
              </span>
              <span className="text-2xl">🏆</span>
            </div>
            <p className="text-3xl font-black text-emerald-950">
              <AnimatedCounter value={profileData.milestonesWon} suffix={profileData.milestonesWon === 1 ? ' Block Won' : ' Blocks Won'} />
            </p>
            <p className="mt-1 text-xs text-emerald-800/80 font-medium">
              5-day study sprints won in friendly competition
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
