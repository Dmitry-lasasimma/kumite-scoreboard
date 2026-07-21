import { MatchScore, Side, ScoreType, PenaltyLevel, MatchOutcome } from '../types/score';
import { SCORE_VALUES, AUTO_WIN_LEAD, SENSHU_WARNING_PENALTIES, HANTEI_JUDGE_COUNT } from '../utils/constants';

/**
 * Points scored from techniques alone, excluding any Hantei judges' flags.
 * Used for the tie-break sequence, which compares the fought score.
 */
export function calculate_technique_total(score: MatchScore, side: Side): number {
  if (side === 'blue') {
    return score.blue_ippon * SCORE_VALUES.ippon
      + score.blue_waza_ari * SCORE_VALUES.waza_ari
      + score.blue_yuko * SCORE_VALUES.yuko;
  }
  return score.red_ippon * SCORE_VALUES.ippon
    + score.red_waza_ari * SCORE_VALUES.waza_ari
    + score.red_yuko * SCORE_VALUES.yuko;
}

/**
 * Displayed total: technique points plus judges' flags awarded by Hantei.
 * Flags count as one point each and are added to the original score.
 */
export function calculate_total(score: MatchScore, side: Side): number {
  const flags = side === 'blue' ? (score.blue_flags || 0) : (score.red_flags || 0);
  return calculate_technique_total(score, side) + flags;
}

export function add_score(score: MatchScore, side: Side, type: ScoreType): MatchScore {
  const updated = { ...score };
  const key = `${side}_${type}` as keyof MatchScore;
  (updated as any)[key] = (updated as any)[key] + 1;
  // Senshu is awarded manually by the operator (no auto-award).
  return updated;
}

/**
 * Manually toggle Senshu for a side. Only one competitor may hold Senshu at a
 * time, so giving it to one side clears it from the other. Toggling the current
 * holder removes it (undo).
 */
export function toggle_senshu(score: MatchScore, side: Side): MatchScore {
  const updated = { ...score };
  const currently_has = side === 'blue' ? updated.blue_zenshu : updated.red_zenshu;
  if (currently_has) {
    updated.blue_zenshu = false;
    updated.red_zenshu = false;
  } else {
    updated.blue_zenshu = side === 'blue';
    updated.red_zenshu = side === 'red';
  }
  return updated;
}

export function remove_score(score: MatchScore, side: Side, type: ScoreType): MatchScore {
  const updated = { ...score };
  const key = `${side}_${type}` as keyof MatchScore;
  const current = (updated as any)[key] as number;
  if (current > 0) {
    (updated as any)[key] = current - 1;
  }
  return updated;
}

/**
 * True when `side` currently holds Senshu and has just taken a penalty that
 * puts it at risk (HC). Senshu is never removed automatically — the operator is
 * reminded and makes the call, so the board always reflects the referee.
 */
export function penalty_threatens_senshu(score: MatchScore, side: Side, level: PenaltyLevel): boolean {
  if (!(SENSHU_WARNING_PENALTIES as readonly string[]).includes(level)) return false;
  return side === 'blue' ? score.blue_zenshu : score.red_zenshu;
}

/**
 * True when this is the very first point of the match and neither competitor
 * holds Senshu yet — the moment Senshu is normally awarded.
 */
export function is_first_score_of_match(score_before: MatchScore): boolean {
  if (score_before.blue_zenshu || score_before.red_zenshu) return false;
  return calculate_technique_total(score_before, 'blue') === 0
    && calculate_technique_total(score_before, 'red') === 0;
}

/**
 * Apply a disqualifying penalty (HANSOKU / SHIKKAKU) against `offender`.
 * The offender's score is zeroed and the opponent is awarded the maximum
 * score of 8 points (set as 2 IPPON + 1 WAZA-ARI = 8) and the win.
 */
export function award_disqualification(score: MatchScore, offender: Side): MatchScore {
  const updated = { ...score };
  // Senshu is irrelevant once the match is decided 8-0; clear both.
  updated.blue_zenshu = false;
  updated.red_zenshu = false;
  // A disqualification decides the match outright — no judges' vote applies.
  updated.blue_flags = 0;
  updated.red_flags = 0;
  if (offender === 'blue') {
    updated.blue_ippon = 0; updated.blue_waza_ari = 0; updated.blue_yuko = 0;
    updated.red_ippon = 2; updated.red_waza_ari = 1; updated.red_yuko = 0;
  } else {
    updated.red_ippon = 0; updated.red_waza_ari = 0; updated.red_yuko = 0;
    updated.blue_ippon = 2; updated.blue_waza_ari = 1; updated.blue_yuko = 0;
  }
  return updated;
}

export function check_auto_win(score: MatchScore): Side | null {
  const blue_total = calculate_technique_total(score, 'blue');
  const red_total = calculate_technique_total(score, 'red');
  if (blue_total - red_total >= AUTO_WIN_LEAD) return 'blue';
  if (red_total - blue_total >= AUTO_WIN_LEAD) return 'red';
  return null;
}

/**
 * Compare the most advanced technique landed by each side. The ranking is
 * IPPON (3) → WAZA-ARI (2) → YUKO (1): whoever has more IPPON wins, and if
 * those are level, whoever has more WAZA-ARI. Returns null when the sides are
 * indistinguishable.
 */
export function compare_advanced_technique(score: MatchScore): Side | null {
  if (score.blue_ippon !== score.red_ippon) {
    return score.blue_ippon > score.red_ippon ? 'blue' : 'red';
  }
  if (score.blue_waza_ari !== score.red_waza_ari) {
    return score.blue_waza_ari > score.red_waza_ari ? 'blue' : 'red';
  }
  if (score.blue_yuko !== score.red_yuko) {
    return score.blue_yuko > score.red_yuko ? 'blue' : 'red';
  }
  return null;
}

/**
 * Resolve a tied match through the full decision sequence:
 *   1. Points scored (techniques + any flags already cast)
 *   2. Senshu (first unopposed point)
 *   3. Most advanced technique (IPPON → WAZA-ARI → YUKO)
 *   4. Hantei — judges' flags
 * When the first three steps cannot separate the competitors, `needs_hantei`
 * is true and the operator must record the judges' vote.
 */
export function resolve_outcome(score: MatchScore): MatchOutcome {
  const blue_total = calculate_total(score, 'blue');
  const red_total = calculate_total(score, 'red');

  if (blue_total !== red_total) {
    const winner: Side = blue_total > red_total ? 'blue' : 'red';
    // If flags were cast, the vote is what separated them.
    const by_flags = (score.blue_flags || 0) !== (score.red_flags || 0)
      && calculate_technique_total(score, 'blue') === calculate_technique_total(score, 'red');
    return { winner, reason: by_flags ? 'hantei' : 'points', needs_hantei: false };
  }

  if (score.blue_zenshu !== score.red_zenshu) {
    return { winner: score.blue_zenshu ? 'blue' : 'red', reason: 'senshu', needs_hantei: false };
  }

  const by_technique = compare_advanced_technique(score);
  if (by_technique) {
    return { winner: by_technique, reason: 'advanced_technique', needs_hantei: false };
  }

  return { winner: null, reason: 'none', needs_hantei: true };
}

/** Winner of the match, or null when a Hantei vote is still required. */
export function determine_winner(score: MatchScore): Side | null {
  return resolve_outcome(score).winner;
}

/**
 * Award one judge's flag to `side`, capped at the size of the judging panel.
 * Flags are added to that side's score.
 */
export function add_flag(score: MatchScore, side: Side): MatchScore {
  const updated = { ...score };
  const cast = (updated.blue_flags || 0) + (updated.red_flags || 0);
  if (cast >= HANTEI_JUDGE_COUNT) return score;
  if (side === 'blue') updated.blue_flags = (updated.blue_flags || 0) + 1;
  else updated.red_flags = (updated.red_flags || 0) + 1;
  return updated;
}

/** Take back one judge's flag from `side` (undo a mis-entry). */
export function remove_flag(score: MatchScore, side: Side): MatchScore {
  const updated = { ...score };
  if (side === 'blue') updated.blue_flags = Math.max(0, (updated.blue_flags || 0) - 1);
  else updated.red_flags = Math.max(0, (updated.red_flags || 0) - 1);
  return updated;
}

/** Clear every flag cast so the vote can be re-entered from scratch. */
export function clear_flags(score: MatchScore): MatchScore {
  return { ...score, blue_flags: 0, red_flags: 0 };
}
