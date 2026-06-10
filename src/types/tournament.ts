export type PairingConstraint = 'same_weight' | 'same_age' | 'both' | 'open';
export type TournamentStatus = 'pending' | 'in_progress' | 'completed';

export interface TournamentCategory {
  id: string;
  name: string;
}

export interface Tournament {
  id: string;
  name: string;
  pairing_constraint: PairingConstraint;
  categories: TournamentCategory[];
  created_at?: string;
  status: TournamentStatus;
}
