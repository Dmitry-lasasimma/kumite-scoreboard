import React from 'react';
import { Side, PenaltyLevel } from '../../types/score';
import { PENALTY_LEVELS, PENALTY_LABELS } from '../../utils/constants';

interface PenaltyDisplayProps {
  penalties: PenaltyLevel[];
  side: Side;
}

export default function PenaltyDisplay({ penalties, side }: PenaltyDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {PENALTY_LEVELS.map(level => {
        const count = penalties.filter(p => p === level).length;
        const is_active = count > 0;
        return (
          <div
            key={level}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 transition-all
              ${is_active
                ? 'bg-white text-gray-900 border-white shadow-2xl scale-105'
                : 'bg-white/10 text-white/40 border-white/25'}`}
          >
            {PENALTY_LABELS[level]}
          </div>
        );
      })}
    </div>
  );
}
