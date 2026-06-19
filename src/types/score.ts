export type PenaltyLevel = '1C' | '2C' | '3C' | '4HC' | '5H' | '6S';

export interface MatchScore {
  id: string;
  match_id: string;
  duration_minutes: number;
  time_remaining: number;
  blue_ippon: number;
  blue_waza_ari: number;
  blue_yuko: number;
  red_ippon: number;
  red_waza_ari: number;
  red_yuko: number;
  blue_zenshu: boolean;
  red_zenshu: boolean;
  updated_at?: string;
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
