export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export interface Match {
  id: string;
  tournament_id: string | null;
  category_id: string | null;
  bracket_round: number;
  blue_competitor_id: string;
  red_competitor_id: string;
  match_number: number;
  status: MatchStatus;
  winner_id: string | null;
  blue_score?: number;   // Final total for the blue (AO) competitor
  red_score?: number;    // Final total for the red (AKA) competitor
  created_at?: string;
}
