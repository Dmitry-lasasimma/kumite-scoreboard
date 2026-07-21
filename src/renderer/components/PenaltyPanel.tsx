import React, { useCallback } from 'react';
import { Side, PenaltyLevel } from '../../types/score';
import { PENALTY_LEVELS, PENALTY_LABELS } from '../../utils/constants';

interface PenaltyPanelProps {
  side: Side;
  penalties: PenaltyLevel[];
  on_add: (level: PenaltyLevel) => void;
  on_remove: () => void;
  /** Disabled while the clock is running, to prevent accidental penalties. */
  disabled?: boolean;
}

export default function PenaltyPanel({
  side, penalties, on_add, on_remove, disabled = false,
}: PenaltyPanelProps) {
  const penalty_counts = PENALTY_LEVELS.reduce((acc, level) => {
    acc[level] = penalties.filter(p => p === level).length;
    return acc;
  }, {} as Record<PenaltyLevel, number>);

  return (
    <div className="mt-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Penalties</span>
        {penalties.length > 0 && (
          <button
            onClick={on_remove}
            disabled={disabled}
            className={`text-xs px-2 py-0.5 rounded-md font-semibold transition-all
              disabled:opacity-30 disabled:cursor-not-allowed
              ${side === 'blue' ? 'text-kumite-blue-500 hover:bg-kumite-blue-50' : 'text-kumite-red-500 hover:bg-kumite-red-50'}`}
          >
            Undo
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {PENALTY_LEVELS.map(level => {
          const is_active = penalty_counts[level] > 0;
          return (
            <button
              key={level}
              onClick={() => on_add(level)}
              disabled={disabled}
              title={disabled ? 'Stop the clock (Yame) before giving a penalty' : undefined}
              className={`btn-penalty flex-1 relative
                ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                ${side === 'blue'
                  ? is_active ? 'btn-penalty-active-blue' : 'btn-penalty-blue'
                  : is_active ? 'btn-penalty-active-red' : 'btn-penalty-red'
                }`}
            >
              {PENALTY_LABELS[level]}
              {penalty_counts[level] > 1 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center font-bold">
                  {penalty_counts[level]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Penalty dots display */}
      <div className="flex gap-1 mt-2 justify-center">
        {penalties.map((p, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              side === 'blue' ? 'bg-kumite-blue-500' : 'bg-kumite-red-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
