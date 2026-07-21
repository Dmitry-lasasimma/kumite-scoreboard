export const APP_NAME = 'Kumite Scoreboard';
export const APP_VERSION = '1.0.2';
export const APP_TAGLINE = 'Tournament management & live scoring for Karate kumite';
export const APP_AUTHOR = 'Dmitry Lasasimma';
export const APP_CONTACT_EMAIL = 'devlasasimma@gmail.com';
export const APP_COPYRIGHT = '© 2026 Dmitry Lasasimma. All Rights Reserved.';

export const SCORE_VALUES = {
  ippon: 3,
  waza_ari: 2,
  yuko: 1,
} as const;

export const MATCH_DURATIONS = [
  { label: '3:00', minutes: 3, seconds: 180 },
  { label: '2:00', minutes: 2, seconds: 120 },
  { label: '1:30', minutes: 1, seconds: 90 },
] as const;

export const DEFAULT_DURATION = 180;

// Spectator timer phases (seconds remaining).
// At or below WARNING the clock turns yellow; at or below CRITICAL it turns red
// and counts in hundredths so the closing exchanges can be read precisely.
export const TIMER_WARNING_SECONDS = 20;
export const TIMER_CRITICAL_SECONDS = 15;

// How often the match clock recomputes and publishes the remaining time. The
// value is derived from the wall clock, so this only sets the update rate — it
// has no bearing on accuracy.
export const CLOCK_TICK_MS = 100;

export const PENALTY_LEVELS = ['1C', '2C', '3C', '4HC', '5H', '6S'] as const;

export const PENALTY_LABELS: Record<string, string> = {
  '1C': 'C1',
  '2C': 'C2',
  '3C': 'C3',
  '4HC': 'HC',
  '5H': 'H',
  '6S': 'S',
};

export const AUTO_WIN_LEAD = 8;

// Hantei: the judges' panel. Total flags that may be cast across both sides.
export const HANTEI_JUDGE_COUNT = 5;

// A reminder popup stays up until it is handled or closed. Once play resumes
// it clears itself after this delay so it never covers a live match.
export const NOTIFICATION_AUTO_DISMISS_MS = 8000;

// Penalties that put the offender's Senshu at risk. Senshu is NOT removed
// automatically — the operator is reminded and decides, so the on-screen state
// always matches the referee's call.
export const SENSHU_WARNING_PENALTIES = ['4HC'] as const;

// Disqualifying penalties: offender's score is zeroed and the opponent is
// awarded the maximum score (8) and the win. 5H = HANSOKU, 6S = SHIKKAKU.
export const DISQUALIFYING_PENALTIES = ['5H', '6S'] as const;
