/**
 * Match sound effects (short beep at 15s remaining, long beep at time-up).
 * Audio files live in public/sounds and are copied to the renderer root by webpack.
 */

let short_beep: HTMLAudioElement | null = null;
let long_beep: HTMLAudioElement | null = null;

/** Lazily create the short-beep audio element. */
function get_short_beep(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!short_beep) short_beep = new Audio('sounds/short-beep.mp3');
  return short_beep;
}

/** Lazily create the long-beep audio element. */
function get_long_beep(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!long_beep) long_beep = new Audio('sounds/long-beep.mp3');
  return long_beep;
}

/** Play the short beep (used at the 15-second warning). */
export function play_short_beep(): void {
  const audio = get_short_beep();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch {}
}

/** Play the long beep (used when time is up). */
export function play_long_beep(): void {
  const audio = get_long_beep();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch {}
}
