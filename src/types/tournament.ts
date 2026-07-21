export type TournamentStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Name given to the category created automatically for tournaments that were
 * saved before categories became mandatory.
 */
export const FALLBACK_CATEGORY_NAME = 'General';

/**
 * How bronze is decided.
 * - `playoff` — one 3rd place: the beaten semi-finalists meet in a 3rd-place
 *   match, and the loser of it takes 4th.
 * - `dual` — two 3rd places: both beaten semi-finalists take bronze and no
 *   3rd-place match is played, so there is no 4th place.
 */
export type ThirdPlaceMode = 'playoff' | 'dual';

/** Tournaments created before this option existed play a 3rd-place match. */
export const DEFAULT_THIRD_PLACE_MODE: ThirdPlaceMode = 'playoff';

export interface TournamentCategory {
  id: string;
  name: string;
}

export interface Tournament {
  id: string;
  name: string;
  /** At least one is required — the draw is made per category. */
  categories: TournamentCategory[];
  default_duration?: number;   // Default match length in seconds (e.g. 180, 120, 90)
  /** Bronze format. Optional so tournaments saved before it existed still load. */
  third_place_mode?: ThirdPlaceMode;
  created_at?: string;
  status: TournamentStatus;
}
