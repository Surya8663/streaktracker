import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StreakResponse, StreakDay } from '@streaktrack/shared';
import { Avatar } from './Avatar';
import { AnimatedCounter } from './AnimatedCounter';

interface StreakCalendarProps {
  data: StreakResponse;
  isOnline?: boolean;
}

export const StreakCalendar: React.FC<StreakCalendarProps> = React.memo(({ data, isOnline = false }) => {
  const { user, currentStreak, longestStreak, totalHours, calendarData } = data;
  const [hoveredDay, setHoveredDay] = useState<{
    day: StreakDay;
    x: number;
    y: number;
  } | null>(null);

  // Group 180 calendar days into weeks (7 days per column)
  const weeks: StreakDay[][] = [];
  let currentWeek: StreakDay[] = [];

  calendarData.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === calendarData.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const levelColorMap = {
    0: 'bg-stone-100 border-stone-200/60 hover:ring-2 hover:ring-stone-300',
    1: 'bg-emerald-200 border-emerald-300 hover:ring-2 hover:ring-emerald-400',
    2: 'bg-emerald-400 border-emerald-500 hover:ring-2 hover:ring-emerald-500',
    3: 'bg-emerald-600 border-emerald-700 hover:ring-2 hover:ring-emerald-700',
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="relative rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-8 shadow-xs transition-all hover:shadow-md">
      {/* Header with Avatar & User Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-100">
        <div className="flex items-center gap-3.5">
          <Avatar name={user.name} src={user.profilePicture} size="lg" showStatus isOnline={isOnline} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-stone-100 text-slate-500 border border-stone-200'
                }`}
              >
                <span>{isOnline ? '🟢' : '⚪'}</span>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              <AnimatedCounter value={totalHours} decimals={1} suffix=" total study hours logged" />
            </p>
          </div>
        </div>

        {/* Streak Badges with Count-Up Animations */}
        <div className="flex items-center gap-3">
          {/* Current Streak */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-2.5 shadow-2xs">
            <span className="text-xl animate-float">🔥</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Current Streak
              </p>
              <p className="text-base font-extrabold text-amber-950 leading-none">
                <AnimatedCounter value={currentStreak} suffix={currentStreak === 1 ? ' Day' : ' Days'} />
              </p>
            </div>
          </div>

          {/* Longest Streak */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-teal-200/80 bg-teal-50/70 px-4 py-2.5 shadow-2xs">
            <span className="text-xl">✨</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                Longest Streak
              </p>
              <p className="text-base font-extrabold text-teal-950 leading-none">
                <AnimatedCounter value={longestStreak} suffix={longestStreak === 1 ? ' Day' : ' Days'} />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="pt-6">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
          <span>Past 6 Months (180 Days)</span>
        </div>

        {/* Calendar Heatmap Grid */}
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200">
          <div className="inline-flex gap-1.5 min-w-max">
            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="flex flex-col gap-1.5">
                {week.map((day) => (
                  <div
                    key={day.date}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        day,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`h-4 w-4 rounded-xs border transition-all cursor-pointer ${levelColorMap[day.level]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-medium pt-3 border-t border-stone-100">
          <span>Less</span>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-xs bg-stone-100 border border-stone-200/60" />
            <span className="h-3.5 w-3.5 rounded-xs bg-emerald-200 border border-emerald-300" />
            <span className="h-3.5 w-3.5 rounded-xs bg-emerald-400 border border-emerald-500" />
            <span className="h-3.5 w-3.5 rounded-xs bg-emerald-600 border border-emerald-700" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Fixed Positioning Floating Tooltip */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: hoveredDay.x,
              top: hoveredDay.y - 12,
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none z-50 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white shadow-xl max-w-xs"
          >
            <p className="font-bold text-slate-200 mb-0.5">
              {formatDate(hoveredDay.day.date)}
            </p>
            {hoveredDay.day.hoursSpent > 0 ? (
              <>
                <p className="text-emerald-400 font-semibold mb-1">
                  ⏱️ {hoveredDay.day.hoursSpent} {hoveredDay.day.hoursSpent === 1 ? 'hour' : 'hours'} logged
                </p>
                {hoveredDay.day.topicsStudied && (
                  <p className="text-slate-300 text-[11px] leading-tight line-clamp-2">
                    {hoveredDay.day.topicsStudied}
                  </p>
                )}
              </>
            ) : (
              <p className="text-slate-400 italic">No study hours logged</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

