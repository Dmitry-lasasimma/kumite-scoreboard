import React, { useState, useCallback } from 'react';
import { format_time, parse_time_input } from '../../utils/validators';
import { MATCH_DURATIONS } from '../../utils/constants';

interface TimerControlProps {
  time_remaining: number;
  is_running: boolean;
  match_status: 'idle' | 'active' | 'finished';
  on_hajime: () => void;
  on_stop: () => void;
  on_resume: () => void;
  on_reset: () => void;
  on_end_match: (silent?: boolean) => void;
  on_time_change: (seconds: number) => void;
  end_highlight?: boolean;
}

export default function TimerControl({
  time_remaining, is_running, match_status,
  on_hajime, on_stop, on_resume, on_reset, on_end_match, on_time_change,
  end_highlight = false,
}: TimerControlProps) {
  const [show_input, set_show_input] = useState(false);
  const [time_input, set_time_input] = useState('');

  const handle_timer_click = useCallback(() => {
    if (!is_running) {
      set_time_input(format_time(time_remaining));
      set_show_input(true);
    }
  }, [is_running, time_remaining]);

  const handle_time_submit = useCallback(() => {
    const seconds = parse_time_input(time_input);
    if (seconds !== null) {
      on_time_change(seconds);
    }
    set_show_input(false);
  }, [time_input, on_time_change]);

  const handle_key_down = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handle_time_submit();
    if (e.key === 'Escape') set_show_input(false);
  }, [handle_time_submit]);

  const is_low_time = time_remaining <= 30 && time_remaining > 0;
  const is_zero = time_remaining <= 0;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Duration Presets */}
      {match_status === 'idle' && (
        <div className="flex gap-1.5">
          {MATCH_DURATIONS.map(d => (
            <button
              key={d.seconds}
              onClick={() => on_time_change(d.seconds)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${time_remaining === d.seconds
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Timer Display */}
      {show_input ? (
        <div className="bg-gray-900 rounded-2xl p-4 w-full">
          <input
            type="text"
            value={time_input}
            onChange={e => set_time_input(e.target.value)}
            onKeyDown={handle_key_down}
            onBlur={handle_time_submit}
            autoFocus
            className="w-full text-center text-3xl font-score text-white bg-transparent border-none outline-none"
            placeholder="MM:SS"
          />
        </div>
      ) : (
        <button
          onClick={handle_timer_click}
          className={`w-full rounded-2xl p-4 text-center transition-all cursor-pointer select-none
            ${is_zero ? 'bg-gray-900' : is_low_time ? 'bg-kumite-red-600 animate-pulse' : 'bg-gray-900'}
            ${!is_running ? 'hover:bg-gray-800' : ''}`}
        >
          <div className={`text-4xl font-score font-bold tracking-wider
            ${is_zero ? 'text-gray-400' : 'text-white'}`}>
            {format_time(time_remaining)}
          </div>
          {match_status === 'active' && (
            <div className={`text-xs mt-1 uppercase tracking-widest font-semibold
              ${is_zero ? 'text-kumite-red-400 animate-pulse' : is_running ? 'text-green-400' : 'text-yellow-400'}`}>
              {is_zero ? 'Time Up' : is_running ? 'Running' : 'Paused'}
            </div>
          )}
        </button>
      )}

      {/* Time Adjust Buttons */}
      {!is_running && match_status !== 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={() => on_time_change(Math.max(0, time_remaining - 10))}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all flex items-center justify-center"
          >
            -10
          </button>
          <button
            onClick={() => on_time_change(Math.max(0, time_remaining - 1))}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all flex items-center justify-center"
          >
            -1
          </button>
          <button
            onClick={() => on_time_change(time_remaining + 1)}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all flex items-center justify-center"
          >
            +1
          </button>
          <button
            onClick={() => on_time_change(time_remaining + 10)}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all flex items-center justify-center"
          >
            +10
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 w-full">
        {match_status === 'idle' && (
          <button
            onClick={on_hajime}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-score text-lg font-bold
                       hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest"
          >
            Hajime
          </button>
        )}

        {match_status === 'active' && is_running && (
          <button
            onClick={on_stop}
            className="w-full py-3 rounded-xl bg-yellow-500 text-gray-900 font-score text-lg font-bold
                       hover:bg-yellow-400 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest"
          >
            Yame
          </button>
        )}

        {match_status === 'active' && !is_running && (
          <div className="flex gap-2">
            <button
              onClick={on_resume}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white font-score text-base font-bold
                         hover:bg-green-500 transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider"
            >
              Tsuzukete
            </button>
            <button
              onClick={on_reset}
              className="py-3 px-4 rounded-xl bg-gray-200 text-gray-700 font-score text-base font-bold
                         hover:bg-gray-300 transition-all active:scale-[0.98]"
            >
              Reset
            </button>
          </div>
        )}

        {match_status === 'active' && (
          <div className="flex gap-2">
            <button
              onClick={() => on_end_match(false)}
              className={`flex-1 py-3 rounded-xl text-white font-score text-base font-bold
                         transition-all shadow-lg active:scale-[0.98] uppercase tracking-wider
                         ${is_zero || end_highlight
                           ? 'bg-kumite-red-600 hover:bg-kumite-red-500 animate-pulse'
                           : 'bg-gray-700 hover:bg-gray-600'}`}
              title="End the match and sound the horn"
            >
              End Match
            </button>
            <button
              onClick={() => on_end_match(true)}
              className="py-3 px-4 rounded-xl bg-gray-100 text-gray-600 font-score text-base font-bold
                         hover:bg-gray-200 transition-all active:scale-[0.98] uppercase tracking-wider
                         flex items-center gap-1.5"
              title="End the match silently (no horn)"
            >
              <span aria-hidden>🔇</span> Silent
            </button>
          </div>
        )}

        {match_status === 'finished' && (
          <button
            onClick={on_reset}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-score text-lg font-bold
                       hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest"
          >
            New Match
          </button>
        )}
      </div>
    </div>
  );
}
