import React from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const statusDotSize = {
  sm: 'h-2.5 w-2.5 ring-2',
  md: 'h-3 w-3 ring-2',
  lg: 'h-4 w-4 ring-2',
  xl: 'h-5 w-5 ring-3',
};

// Map name initials to soft pastel gradient combinations
const pastelGradients: Record<string, string> = {
  S: 'from-amber-200 to-rose-200 text-amber-900',
  G: 'from-emerald-200 to-teal-200 text-emerald-900',
  A: 'from-sky-200 to-indigo-200 text-indigo-900',
  B: 'from-purple-200 to-pink-200 text-purple-900',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  isOnline = false,
  showStatus = false,
  className = '',
}) => {
  const getInitials = (str: string) => {
    if (!str) return '?';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return str.slice(0, 1).toUpperCase();
  };

  const initialChar = getInitials(name)[0] || 'S';
  const gradient = pastelGradients[initialChar] || 'from-indigo-200 to-violet-200 text-indigo-900';

  return (
    <div className="relative inline-block">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`rounded-full object-cover shadow-xs ring-2 ring-white/80 ${sizeClasses[size]} ${className}`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-full bg-gradient-to-br font-semibold shadow-xs ring-2 ring-white/80 ${gradient} ${sizeClasses[size]} ${className}`}
          title={name}
        >
          {getInitials(name)}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-white ${statusDotSize[size]} ${
            isOnline
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
              : 'bg-slate-300'
          }`}
          title={isOnline ? `${name} is online` : `${name} is offline`}
        />
      )}
    </div>
  );
};
