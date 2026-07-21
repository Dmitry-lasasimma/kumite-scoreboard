import React from 'react';
import { HANTEI_JUDGE_COUNT } from '../../utils/constants';

interface HanteiPanelProps {
  blue_name: string;
  red_name: string;
  blue_flags: number;
  red_flags: number;
  on_add_flag: (side: 'blue' | 'red') => void;
  on_remove_flag: (side: 'blue' | 'red') => void;
  on_clear: () => void;
  on_confirm: () => void;
}

/**
 * Judges' flag entry, shown when a tied match reaches HANTEI. Each flag counts
 * as one point and is added to that side's score, so the side with more flags
 * takes the win. The panel is limited to the size of the judging panel.
 */
export default function HanteiPanel({
  blue_name, red_name, blue_flags, red_flags,
  on_add_flag, on_remove_flag, on_clear, on_confirm,
}: HanteiPanelProps) {
  const cast = blue_flags + red_flags;
  const remaining = HANTEI_JUDGE_COUNT - cast;
  const is_tied = blue_flags === red_flags;
  const can_confirm = cast > 0 && !is_tied;

  const render_side = (
    side: 'blue' | 'red', name: string, flags: number,
  ) => {
    const is_blue = side === 'blue';
    return (
      // min-w-0 is what lets the name truncate: without it the flex item is
      // sized to its content and a long name pushes the panel out of its column.
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <div className={`w-full text-center font-bold uppercase tracking-widest text-[11px]
          ${is_blue ? 'text-kumite-blue-700' : 'text-kumite-red-700'}`}>
          {is_blue ? 'AO' : 'AKA'}
        </div>
        <div className="w-full text-center text-[11px] text-gray-500 truncate" title={name}>
          {name}
        </div>
        <div className="flex gap-1 shrink-0">
          {Array.from({ length: HANTEI_JUDGE_COUNT }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`w-2 h-4 rounded-sm transition-all
                ${i < flags
                  ? (is_blue ? 'bg-kumite-blue-600' : 'bg-kumite-red-600')
                  : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <div className={`text-4xl font-score font-bold leading-none
          ${is_blue ? 'text-kumite-blue-700' : 'text-kumite-red-700'}`}>
          {flags}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => on_remove_flag(side)}
            disabled={flags === 0}
            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            −
          </button>
          <button
            onClick={() => on_add_flag(side)}
            disabled={remaining <= 0}
            className={`w-8 h-8 rounded-lg text-white font-bold transition-all
                        disabled:opacity-30 disabled:cursor-not-allowed
                        ${is_blue
                          ? 'bg-kumite-blue-600 hover:bg-kumite-blue-500'
                          : 'bg-kumite-red-600 hover:bg-kumite-red-500'}`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card p-3 w-full min-w-0 border-t-4 border-yellow-400 overflow-hidden">
      <div className="text-center mb-3">
        <div className="text-sm font-score font-bold uppercase tracking-widest text-gray-900">
          Hantei
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          Scores level — judges decide
        </div>
      </div>

      <div className="flex gap-2 min-w-0">
        {render_side('blue', blue_name, blue_flags)}
        <div className="w-px bg-gray-200 shrink-0" />
        {render_side('red', red_name, red_flags)}
      </div>

      <div className="text-center text-[11px] text-gray-400 mt-3">
        {remaining > 0
          ? `${remaining} of ${HANTEI_JUDGE_COUNT} flags remaining`
          : `All ${HANTEI_JUDGE_COUNT} flags cast`}
      </div>

      {cast > 0 && is_tied && (
        <div className="text-center text-[11px] font-semibold text-yellow-600 mt-1">
          Flags are level — the vote must separate the competitors
        </div>
      )}

      <div className="flex gap-2 mt-3 min-w-0">
        <button
          onClick={on_confirm}
          disabled={!can_confirm}
          className="flex-1 min-w-0 py-3 rounded-xl bg-gray-900 text-white font-score text-base font-bold
                     hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider
                     disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          Confirm
        </button>
        <button
          onClick={on_clear}
          disabled={cast === 0}
          className="shrink-0 py-3 px-3 rounded-xl bg-gray-100 text-gray-600 font-score text-base font-bold
                     hover:bg-gray-200 transition-all active:scale-[0.98]
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
