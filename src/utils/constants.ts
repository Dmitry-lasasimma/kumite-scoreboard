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

export const ZENSHU_REMOVING_PENALTIES = ['4HC', '5H'] as const;

// Disqualifying penalties: offender's score is zeroed and the opponent is
// awarded the maximum score (8) and the win. 5H = HANSOKU, 6S = SHIKKAKU.
export const DISQUALIFYING_PENALTIES = ['5H', '6S'] as const;
