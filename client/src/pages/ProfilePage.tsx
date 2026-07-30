import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { API_ROUTES } from '@streaktrack/shared';
import type { ProfileStatsResponse } from '@streaktrack/shared';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api.js';

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
      const res = await fetch(getApiUrl(`${API_ROUTES.PROFILE}/${user.id}`), { credentials: 'include' });
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
      const res = await fetch(getApiUrl(API_ROUTES.PROFILE), {
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
      const res = await fetch(getApiUrl(API_ROUTES.UPLOAD_AVATAR), {
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
          <p className="text-sm font-medium text-slate-500">Loading user profile...</p>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="space-y-8 pb-12"
    >
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Main Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-2xs border-t-3 border-t-teal-500">
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

                {/* GitHub & LinkedIn Social Badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  {u.githubUrl && (
                    <a
                      href={u.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-stone-200 border border-stone-200/80 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span>GitHub ↗</span>
                    </a>
                  )}
                  {u.linkedinUrl && (
                    <a
                      href={u.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 hover:bg-sky-100 border border-sky-200/80 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                      <span>LinkedIn ↗</span>
                    </a>
                  )}
                </div>
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
      </div>

      {/* Editable Goal & About Card */}
      <div className="rounded-3xl border border-teal-200/80 bg-teal-50/50 p-6 sm:p-8 shadow-2xs border-t-3 border-t-teal-500">
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
      </div>

      {/* Lifetime Stats Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Lifetime Study & Streak Stats</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Study Hours */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-emerald-500">
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
          </div>

          {/* Current Streak */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Current Streak
              </span>
              <span className="text-2xl">🔥</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.currentStreak} suffix=" days" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Consecutive study days</p>
          </div>

          {/* Best Streak Record */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Longest Streak Record
              </span>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.longestStreak} suffix=" days" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Personal best record</p>
          </div>

          {/* Days Active */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-teal-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Days Active
              </span>
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.totalDaysActive} suffix=" days" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Days with logged study hours</p>
          </div>

          {/* Milestones Won */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Milestones Won
              </span>
              <span className="text-2xl">🏆</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              <AnimatedCounter value={profileData.milestonesWon} suffix=" blocks" />
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">5-day sprint blocks won</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
