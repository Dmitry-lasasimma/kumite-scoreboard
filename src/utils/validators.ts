import { Competitor } from '../types/competitor';

export function validate_competitor(data: Partial<Competitor>): string[] {
  const errors: string[] = [];
  if (!data.first_name?.trim()) errors.push('First name is required');
  if (!data.last_name?.trim()) errors.push('Last name is required');
  if (!data.club?.trim()) errors.push('Club is required');
  return errors;
}

export function format_time(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parse_time_input(input: string): number | null {
  const parts = input.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs) && mins >= 0 && secs >= 0 && secs < 60) {
      return mins * 60 + secs;
    }
  }
  return null;
}
