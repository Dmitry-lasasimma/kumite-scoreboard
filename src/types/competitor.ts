export interface Competitor {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  /**
   * The tournament category this competitor competes in. Categories are defined
   * per tournament by the operator and are what the draw is built from, so a
   * competitor without one cannot be placed in a bracket.
   */
  category_id: string | null;
  created_at?: string;
}
