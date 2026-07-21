import React from 'react';
import { Side, PenaltyLevel } from '../../types/score';
import { PENALTY_LEVELS, PENALTY_LABELS } from '../../utils/constants';

interface PenaltyDisplayProps {
  penalties: PenaltyLevel[];
  side: Side;
}

export default function PenaltyDisplay({ penalties, side }: PenaltyDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-[1.2vw] shrink-0">
      {PENALTY_LEVELS.map(level => {
        const count = penalties.filter(p => p === level).length;
        const is_active = count > 0;
        return (
          <div
            key={level}
            className={`rounded-full flex items-center justify-center font-bold transition-all
              ${is_active
                ? 'bg-white text-gray-900 border-white shadow-2xl scale-105'
                : 'bg-white/10 text-white/40 border-white/25'}`}
            style={{
              width: 'min(7vh, 5.4vw)',
              height: 'min(7vh, 5.4vw)',
              fontSize: 'min(2.8vh, 2.1vw)',
              borderWidth: 'min(0.45vh, 0.35vw)',
              borderStyle: 'solid',
            }}
          >
            {PENALTY_LABELS[level]}
          </div>
        );
      })}
    </div>
  );
}
