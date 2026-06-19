import { MatchScore, Side, ScoreType, PenaltyLevel } from '../types/score';
import { SCORE_VALUES, AUTO_WIN_LEAD, ZENSHU_REMOVING_PENALTIES } from '../utils/constants';

export function calculate_total(score: MatchScore, side: Side): number {
  if (side === 'blue') {
    return score.blue_ippon * SCORE_VALUES.ippon
      + score.blue_waza_ari * SCORE_VALUES.waza_ari
      + score.blue_yuko * SCORE_VALUES.yuko;
  }
  return score.red_ippon * SCORE_VALUES.ippon
    + score.red_waza_ari * SCORE_VALUES.waza_ari
    + score.red_yuko * SCORE_VALUES.yuko;
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

export function apply_penalty_zenshu(score: MatchScore, side: Side, level: PenaltyLevel): MatchScore {
  const updated = { ...score };
  if (ZENSHU_REMOVING_PENALTIES.includes(level as any)) {
    if (side === 'blue') updated.blue_zenshu = false;
    if (side === 'red') updated.red_zenshu = false;
  }
  return updated;
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
  const blue_total = calculate_total(score, 'blue');
  const red_total = calculate_total(score, 'red');
  if (blue_total - red_total >= AUTO_WIN_LEAD) return 'blue';
  if (red_total - blue_total >= AUTO_WIN_LEAD) return 'red';
  return null;
}

export function determine_winner(score: MatchScore): Side | null {
  const blue_total = calculate_total(score, 'blue');
  const red_total = calculate_total(score, 'red');

  if (blue_total > red_total) return 'blue';
  if (red_total > blue_total) return 'red';

  if (score.blue_zenshu && !score.red_zenshu) return 'blue';
  if (score.red_zenshu && !score.blue_zenshu) return 'red';

  return null;
}
