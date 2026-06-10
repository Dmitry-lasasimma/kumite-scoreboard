export type WeightCategory = 'Light' | 'Medium' | 'Heavy';
export type AgeCategory = 'U12' | 'U16' | 'U21' | 'Senior';

export interface Competitor {
  id: string;
  first_name: string;
  last_name: string;
  club: string;
  weight_category: WeightCategory | null;
  age_category: AgeCategory | null;
  category_id: string | null;
  created_at?: string;
}
