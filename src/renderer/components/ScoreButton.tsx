import React, { useCallback } from 'react';
import { Side } from '../../types/score';

interface ScoreButtonProps {
  label: string;
  value: number;
  points: string;
  side: Side;
  on_add: () => void;
  on_remove: () => void;
  /** Disabled while the clock is running, to prevent accidental scoring. */
  disabled?: boolean;
}

export default function ScoreButton({
  label, value, points, side, on_add, on_remove, disabled = false,
}: ScoreButtonProps) {
  const handle_context = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled) on_remove();
  }, [on_remove, disabled]);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={on_add}
        onContextMenu={handle_context}
        disabled={disabled}
        title={disabled ? 'Stop the clock (Yame) before awarding a score' : undefined}
        className={`btn-score ${side === 'blue' ? 'btn-score-blue' : 'btn-score-red'}
          flex flex-col items-center justify-center py-4 px-2 min-h-[100px]
          ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
      >
        <span className="text-xs uppercase tracking-widest opacity-80">{label}</span>
        <span className="text-4xl font-bold leading-none mt-1">{value}</span>
        <span className="text-[10px] opacity-60 mt-1">{points}</span>
      </button>
      <button
        onClick={on_remove}
        disabled={disabled}
        className={`text-xs py-1 rounded-lg font-semibold transition-all opacity-60 hover:opacity-100
          disabled:opacity-20 disabled:cursor-not-allowed
          ${side === 'blue' ? 'text-kumite-blue-600 hover:bg-kumite-blue-50' : 'text-kumite-red-600 hover:bg-kumite-red-50'}`}
      >
        -1
      </button>
    </div>
  );
}
