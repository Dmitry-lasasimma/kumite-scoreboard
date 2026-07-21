import { useEffect, useState } from 'react';
import { ClockAnchor } from '../types/score';

/**
 * Exact remaining time on the match clock.
 *
 * A running clock is described by an anchor — where it started and when —
 * rather than by a sampled reading, so the value here is computed fresh from
 * the wall clock on every animation frame. Nothing in the pipeline is
 * quantised: publishing a sampled reading on a fixed interval would peg the
 * hundredths to the publish rate, showing only a handful of values (…99, …89,
 * …79) no matter how often it was sent.
 *
 * When the clock is stopped there is no anchor, and the stored value already
 * holds the exact fraction it was paused on.
 *
 * @param time_remaining Seconds remaining, used while the clock is stopped.
 * @param anchor The running clock, or null when stopped.
 * @param active Whether sub-second precision is needed — pass false to skip the
 *   animation loop when the display only shows whole seconds.
 * @returns Seconds remaining, accurate to the current frame.
 */
export function use_precise_time(
  time_remaining: number,
  anchor: ClockAnchor | null,
  active: boolean = true,
): number {
  const [, force_frame] = useState(0);
  const interpolating = !!anchor && active;

  useEffect(() => {
    if (!interpolating) return;
    let frame = 0;
    const tick = () => {
      force_frame(n => n + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [interpolating]);

  if (!anchor) return time_remaining;
  const projected = Math.max(0, anchor.from - (Date.now() - anchor.at) / 1000);
  // Above the precision window the loop is idle, so fall back to the stored
  // value once the projection would go stale.
  return active ? projected : Math.min(time_remaining, projected);
}
