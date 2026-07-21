export type PenaltyLevel = '1C' | '2C' | '3C' | '4HC' | '5H' | '6S';

export interface MatchScore {
  id: string;
  match_id: string;
  duration_minutes: number;
  /** Seconds left on the match clock, carrying a sub-second fraction. */
  time_remaining: number;
  blue_ippon: number;
  blue_waza_ari: number;
  blue_yuko: number;
  red_ippon: number;
  red_waza_ari: number;
  red_yuko: number;
  blue_zenshu: boolean;
  red_zenshu: boolean;
  /** Judges' flags awarded by Hantei vote. Each flag counts as one point. */
  blue_flags: number;
  red_flags: number;
  updated_at?: string;
}

/**
 * A running match clock, described by where it started rather than by a sampled
 * reading. Any window can compute the exact remaining time from this at any
 * moment, so the displayed value is never quantised to a publish rate.
 * `at` is a `Date.now()` timestamp, which is shared across windows.
 */
export interface ClockAnchor {
  /** Seconds remaining when the clock started. */
  from: number;
  /** Wall-clock time the clock started, from `Date.now()`. */
  at: number;
}

/** Status of a match as seen by the operator and the spectator display. */
export type MatchStatus = 'idle' | 'active' | 'hantei' | 'finished';

/** How a finished match was decided — used for display/logging. */
export type WinReason =
  | 'points'
  | 'senshu'
  | 'advanced_technique'
  | 'hantei'
  | 'disqualification'
  | 'none';

export interface MatchOutcome {
  winner: Side | null;
  reason: WinReason;
  /** True when every tie-break is exhausted and a judges' vote is required. */
  needs_hantei: boolean;
}

export interface MatchPenalty {
  id: string;
  match_id: string;
  competitor_id: string;
  penalty_level: PenaltyLevel;
  created_at?: string;
}

export type Side = 'blue' | 'red';
export type ScoreType = 'ippon' | 'waza_ari' | 'yuko';

/**
 * Operator reminders shown as popups during a match.
 * - `senshu_award`  — first point of the match landed; Senshu may be due.
 * - `senshu_revoke` — the Senshu holder took a HC penalty; Senshu may be lost.
 */
export type NotificationKind = 'senshu_award' | 'senshu_revoke';

export interface OperatorNotification {
  id: string;
  kind: NotificationKind;
  /** The competitor the reminder concerns. */
  side: Side;
  title: string;
  message: string;
}
