import { Competitor } from '../types/competitor';
import { TIMER_CRITICAL_SECONDS } from './constants';

export function validate_competitor(data: Partial<Competitor>): string[] {
  const errors: string[] = [];
  if (!data.first_name?.trim()) errors.push('First name is required');
  if (!data.last_name?.trim()) errors.push('Last name is required');
  if (!data.club?.trim()) errors.push('Club is required');
  // The draw is made per category, so a competitor without one cannot be placed.
  if (!data.category_id) errors.push('Category is required');
  return errors;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

/**
 * MM:SS for a countdown.
 *
 * The clock carries sub-second precision and this TRUNCATES, matching
 * `format_time_precise`: at 15.99s both read "00:15", one as "00:15" and the
 * other as "00:15.99". Rounding up here instead would make the whole-second
 * clock read one higher than the precise clock, so the moment the display
 * switched to hundredths the number would appear to skip a second
 * ("00:16" straight to "00:14.99").
 */
export function format_time(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/**
 * True once the clock reads at or below the critical threshold — that is, when
 * the DISPLAYED seconds are 15 or fewer, which starts at 15.99s remaining.
 * Both the operator and the spectator switch to hundredths on this boundary so
 * the two windows never disagree.
 */
export function is_precise_window(seconds: number): boolean {
  return Math.floor(Math.max(0, seconds)) <= TIMER_CRITICAL_SECONDS;
}

/**
 * MM:SS plus hundredths, for the closing seconds of a round. Unlike
 * `format_time` this truncates, so 12.47s reads "00:12" + "47" — the two parts
 * always belong to the same instant.
 */
export function format_time_precise(seconds: number): { mm_ss: string; hundredths: string } {
  // Work in whole hundredths so both halves come from one number: subtracting
  // the seconds first loses precision (74.05 - 74 lands just under 0.05, which
  // would print ".04"). The epsilon absorbs the same rounding noise in the
  // multiplication.
  const total_cs = Math.floor(Math.max(0, seconds) * 100 + 1e-6);
  const whole = Math.floor(total_cs / 100);
  return {
    mm_ss: `${pad2(Math.floor(whole / 60))}:${pad2(whole % 60)}`,
    hundredths: pad2(total_cs % 100),
  };
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
