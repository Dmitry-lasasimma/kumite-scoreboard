import React from 'react';
import { format_time, format_time_precise, is_precise_window } from '../../utils/validators';
import { TIMER_WARNING_SECONDS, TIMER_CRITICAL_SECONDS } from '../../utils/constants';
import FixedDigits from '../../shared/fixed_digits';
import { use_precise_time } from '../../shared/use_precise_time';
import { ClockAnchor } from '../../types/score';

interface TimerDisplayProps {
  time_remaining: number;
  is_running: boolean;
  /** The running clock, used to render the exact time each frame. */
  clock_anchor: ClockAnchor | null;
  /** Hidden while the judges' vote is being recorded. */
  is_hantei?: boolean;
}

type Phase = 'normal' | 'warning' | 'critical' | 'expired';

/**
 * Which colour phase a given number of seconds falls into, decided on the
 * DISPLAYED seconds rather than the raw value: the clock turns yellow as it
 * reads 20 and red as it reads 15, which is what the hall sees.
 */
function get_phase(seconds: number): Phase {
  if (seconds <= 0) return 'expired';
  const displayed = Math.floor(seconds);
  if (displayed <= TIMER_CRITICAL_SECONDS) return 'critical';
  if (displayed <= TIMER_WARNING_SECONDS) return 'warning';
  return 'normal';
}

const PHASE_COLOR: Record<Phase, string> = {
  normal: 'text-white',
  warning: 'text-yellow-400',
  critical: 'text-red-500',
  expired: 'text-red-600',
};

const PHASE_GLOW: Record<Phase, string> = {
  normal: '0 0 6vh rgba(255,255,255,0.20)',
  warning: '0 0 7vh rgba(250,204,21,0.45)',
  critical: '0 0 8vh rgba(239,68,68,0.55)',
  expired: '0 0 8vh rgba(220,38,38,0.45)',
};

/**
 * Arena clock. The operator publishes the remaining time several times a second
 * with sub-second precision; inside the final CRITICAL window this display
 * interpolates between those updates with requestAnimationFrame so the
 * hundredths run smoothly, re-syncing on every message it receives. When the
 * clock is stopped it shows the exact value it was paused on.
 */
export default function TimerDisplay({
  time_remaining, is_running, clock_anchor, is_hantei = false,
}: TimerDisplayProps) {
  // Sub-second precision is only needed in the closing seconds — from the moment
  // the clock reads 15 (15.99s remaining), so the hundredths start at 15 rather
  // than picking up mid-way through 14.
  const shown = use_precise_time(time_remaining, clock_anchor, is_precise_window(time_remaining));
  const phase = get_phase(shown);
  // Hundredths stay on show while stopped inside the closing window, so the
  // operator and the hall can both read exactly where the round was halted.
  const show_hundredths = is_precise_window(shown) && shown > 0;
  const parts = format_time_precise(shown);

  const status_label = is_hantei ? 'Hantei'
    : shown <= 0 ? 'Time Up'
    : is_running ? 'Fight' : 'Stopped';

  const status_color = is_hantei ? 'text-yellow-400'
    : shown <= 0 ? 'text-red-500'
    : is_running ? 'text-green-400' : 'text-yellow-400';

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div
        className={`font-score font-bold leading-none flex items-baseline justify-center
          transition-colors duration-300 ${PHASE_COLOR[phase]}
          ${phase === 'expired' ? 'animate-pulse' : ''}`}
        style={{
          fontSize: 'min(22vh, 19vw)',
          textShadow: PHASE_GLOW[phase],
        }}
        aria-label="Time remaining"
      >
        <span><FixedDigits text={show_hundredths ? parts.mm_ss : format_time(shown)} /></span>
        {show_hundredths && (
          <span className="opacity-90" style={{ fontSize: '0.52em' }}>
            <FixedDigits text={`.${parts.hundredths}`} />
          </span>
        )}
      </div>

      <div
        className={`uppercase font-bold tracking-[0.4em] mt-[0.6vh] ${status_color}
          ${is_running || is_hantei ? 'animate-pulse' : ''}`}
        style={{ fontSize: 'min(2.3vh, 1.8vw)' }}
      >
        {status_label}
      </div>
    </div>
  );
}
