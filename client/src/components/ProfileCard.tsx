import React from 'react';
import type { User } from '@streaktrack/shared';
import { Avatar } from './Avatar';

interface ProfileCardProps {
  user: User | null;
  isOnline?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = React.memo(({ user, isOnline = false }) => {
  if (!user) return null;

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs border-t-3 border-t-teal-500 space-y-4">
      {/* Header with Avatar & Name */}
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} src={user.profilePicture} size="lg" showStatus isOnline={isOnline} />
        <div className="overflow-hidden">
          <h3 className="font-extrabold text-slate-900 text-base truncate">{user.name}</h3>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
          {user.bio && (
            <p className="text-[11px] text-teal-700 font-medium mt-0.5 truncate">{user.bio}</p>
          )}
        </div>
      </div>

      {/* Social Links Row */}
      {(user.githubUrl || user.linkedinUrl) && (
        <div className="pt-3 border-t border-stone-100 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Social & Code Profiles
          </p>

          <div className="flex flex-col gap-2">
            {user.githubUrl && (
              <a
                href={user.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex items-center justify-between gap-2 rounded-xl bg-stone-100/80 hover:bg-stone-200/70 border border-stone-200/60 px-3.5 py-2 text-xs font-bold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-700 group-hover:scale-110 transition-transform fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub Profile</span>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-700">↗</span>
              </a>
            )}

            {user.linkedinUrl && (
              <a
                href={user.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex items-center justify-between gap-2 rounded-xl bg-sky-50/80 hover:bg-sky-100/70 border border-sky-200/60 px-3.5 py-2 text-xs font-bold text-sky-900 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-700 group-hover:scale-110 transition-transform fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  <span>LinkedIn Profile</span>
                </div>
                <span className="text-[11px] text-sky-400 group-hover:text-sky-700">↗</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
