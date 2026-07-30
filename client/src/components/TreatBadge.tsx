import React from 'react';
import { motion } from 'framer-motion';

interface TreatBadgeProps {
  otherUserName: string;
  treatsOwedCount: number;
  onClick?: () => void;
}

export const TreatBadge: React.FC<TreatBadgeProps> = React.memo(({
  otherUserName,
  treatsOwedCount,
  onClick,
}) => {
  if (treatsOwedCount <= 0) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-2xl shadow-2xs">
            🍫
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Friendly Nudge
              </span>
              {treatsOwedCount > 1 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  x{treatsOwedCount} Treats
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-bold text-amber-950">
              You owe {otherUserName} a treat!
            </p>
            <p className="text-xs text-amber-800/80">
              {otherUserName} logged more hours in {treatsOwedCount === 1 ? 'a recent' : `${treatsOwedCount} recent`} 5-day block. Time for a chocolate bar! 🍬
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-block rounded-xl border border-amber-300/60 bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-2xs hover:bg-white">
          View Scoreboard →
        </span>
      </div>
    </motion.div>
  );
});

