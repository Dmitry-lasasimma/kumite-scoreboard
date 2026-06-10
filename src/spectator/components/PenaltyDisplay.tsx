import React from 'react';
import { Side, PenaltyLevel } from '../../types/score';
import { PENALTY_LEVELS, PENALTY_LABELS } from '../../utils/constants';

interface PenaltyDisplayProps {
  penalties: PenaltyLevel[];
  side: Side;
}

export default function PenaltyDisplay({ penalties, side }: PenaltyDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {PENALTY_LEVELS.map(level => {
        const count = penalties.filter(p => p === level).length;
        const is_active = count > 0;
        return (
          <div
            key={level}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
              ${is_active
                ? 'bg-white text-gray-900 border-white shadow-lg'
                : 'bg-white/10 text-white/40 border-white/20'}`}
          >
            {PENALTY_LABELS[level]}
          </div>
        );
      })}
    </div>
  );
}
