import { Competitor } from '../types/competitor';
import { Match } from '../types/match';
import { PairingConstraint } from '../types/tournament';
import { v4 as uuid } from 'uuid';

/* ───────────────────── helpers ───────────────────── */

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function next_power_of_two(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function get_total_rounds(count: number): number {
  if (count <= 1) return 0;
  return Math.ceil(Math.log2(count));
}

/**
 * Get matches for a specific tournament+category, sorted by match_number.
 */
function get_scoped(
  all: Match[],
  tid: string | null,
  cid: string | null,
): Match[] {
  return all.filter(m => m.tournament_id === tid && m.category_id === cid);
}

function get_round(
  scoped: Match[],
  round: number,
): Match[] {
  return scoped
    .filter(m => m.bracket_round === round)
    .sort((a, b) => a.match_number - b.match_number);
}

function get_total_rounds_from_matches(scoped: Match[]): number {
  const pos = scoped.filter(m => m.bracket_round > 0);
  if (pos.length === 0) return 0;
  return Math.max(...pos.map(m => m.bracket_round));
}

/* ───────────────── advance one winner ───────────────── */

/**
 * Place a winner into the correct next-round slot.
 * Mutates the matches array in place.
 */
function place_winner_in_next_round(
  scoped: Match[],
  round: number,
  match_index_in_round: number,
  winner_id: string,
): void {
  const total = get_total_rounds_from_matches(scoped);
  const next = round + 1;
  if (next > total) return;

  const next_matches = get_round(scoped, next);
  const target_idx = Math.floor(match_index_in_round / 2);
  const is_blue = match_index_in_round % 2 === 0;

  if (next_matches[target_idx]) {
    if (is_blue) {
      next_matches[target_idx].blue_competitor_id = winner_id;
    } else {
      next_matches[target_idx].red_competitor_id = winner_id;
    }
  }
}

/**
 * Place a semifinal loser into the 3rd-place match.
 * Mutates the matches array in place.
 */
function place_loser_in_third(
  scoped: Match[],
  loser_id: string,
): void {
  if (loser_id === 'BYE') return;
  const third = scoped.find(m => m.bracket_round === -1);
  if (!third) return;

  if (third.blue_competitor_id === 'TBD') {
    third.blue_competitor_id = loser_id;
  } else if (third.red_competitor_id === 'TBD') {
    third.red_competitor_id = loser_id;
  }
}

/* ──────────── cascade auto-complete ──────────── */

/**
 * Repeatedly scan for matches that can never receive both competitors
 * (because the source match doesn't exist or was a BYE) and auto-
 * complete them. Also auto-awards 3rd place when only one real
 * competitor remains. Handles ALL edge cases:
 *   - 3 competitors: 3rd place auto-awarded to sole semifinal loser
 *   - 5/6 competitors: R2 match auto-completed when R1 slot missing
 *   - Cascading BYEs across multiple rounds
 *
 * Mutates `matches` in place.
 */
function cascade_auto_complete(matches: Match[], tid: string | null, cid: string | null): void {
  let changed = true;
  while (changed) {
    changed = false;
    const scoped = get_scoped(matches, tid, cid);
    const total = get_total_rounds_from_matches(scoped);

    /* ── 1. Auto-complete regular matches with an impossible TBD ── */
    for (let round = 2; round <= total; round++) {
      const round_matches = get_round(scoped, round);
      const prev_matches = get_round(scoped, round - 1);

      for (let idx = 0; idx < round_matches.length; idx++) {
        const m = round_matches[idx];
        if (m.status !== 'pending') continue;

        const has_blue = m.blue_competitor_id !== 'TBD';
        const has_red  = m.red_competitor_id  !== 'TBD';

        if (has_blue && has_red) continue; // both filled → real match, wait

        const blue_source_idx = idx * 2;
        const red_source_idx  = idx * 2 + 1;
        const blue_source_exists = blue_source_idx < prev_matches.length;
        const red_source_exists  = red_source_idx  < prev_matches.length;

        if (!has_blue && !has_red) {
          // Both TBD — check if both sources are missing (phantom match)
          if (!blue_source_exists && !red_source_exists) {
            // Neither source exists → phantom match, remove entirely
            const match_idx = matches.findIndex(x => x.id === m.id);
            if (match_idx >= 0) {
              matches.splice(match_idx, 1);
              changed = true;
            }
          }
          // If at least one source exists, wait for it to complete
          continue;
        }

        // One side filled, one TBD — check if the TBD source exists
        const source_idx = has_blue ? red_source_idx : blue_source_idx;
        const source_exists = source_idx < prev_matches.length;

        if (!source_exists) {
          // Source doesn't exist → auto-complete with the filled side as winner
          const winner_id = has_blue ? m.blue_competitor_id : m.red_competitor_id;
          if (!has_blue) m.blue_competitor_id = 'BYE';
          if (!has_red) m.red_competitor_id = 'BYE';
          m.status = 'completed';
          m.winner_id = winner_id;

          // Advance winner to next round
          place_winner_in_next_round(scoped, round, idx, winner_id);
          changed = true;
        }
      }
    }

    /* ── 2. Auto-complete 3rd-place match ── */
    const third = scoped.find(m => m.bracket_round === -1 && m.status === 'pending');
    if (third && total >= 2) {
      // A slot only counts as a real opponent when it holds an actual
      // competitor — 'TBD' (unfilled) and 'BYE' (no opponent) do not.
      const real_blue = third.blue_competitor_id !== 'TBD' && third.blue_competitor_id !== 'BYE';
      const real_red  = third.red_competitor_id  !== 'TBD' && third.red_competitor_id  !== 'BYE';

      const semi_round = total - 1;
      const semis = get_round(scoped, semi_round);
      const all_semis_done = semis.length > 0 && semis.every(m => m.status === 'completed');

      // Case A: exactly one real competitor (the other is a BYE or will never
      // be filled) → award 3rd place to that competitor once the semis settle.
      if (real_blue !== real_red && all_semis_done) {
        const winner_id = real_blue ? third.blue_competitor_id : third.red_competitor_id;
        if (!real_blue) third.blue_competitor_id = 'BYE';
        if (!real_red)  third.red_competitor_id  = 'BYE';
        third.status = 'completed';
        third.winner_id = winner_id;
        changed = true;
      }

      // Case B: no real competitors at all but semis done → drop the 3rd place.
      if (!real_blue && !real_red && all_semis_done) {
        third.status = 'completed';
        third.winner_id = null;
        changed = true;
      }
    }

    // Special case: only 2 real competitors in a 3+ bracket where 3rd place
    // has both TBD but one semifinal is completed
    // (handled by Case B above on next iteration)
  }
}

/* ───────────────── public API ───────────────── */

/**
 * Generate a complete single-elimination bracket.
 *
 * Creates Round 1 matches (with BYE auto-completes), placeholder
 * matches for subsequent rounds, a 3rd-place match (3+ competitors),
 * and then cascades auto-completion so that BYE advantages propagate
 * correctly through every round.
 */
export function generate_bracket(
  competitors: Competitor[],
  tournament_id: string,
  constraint: PairingConstraint,
  category_id: string | null = null,
): Match[] {
  let pool = [...competitors];

  // Sort by constraint before shuffling within groups
  if (constraint === 'same_weight') {
    pool.sort((a, b) => (a.weight_category || '').localeCompare(b.weight_category || ''));
  } else if (constraint === 'same_age') {
    pool.sort((a, b) => (a.age_category || '').localeCompare(b.age_category || ''));
  } else if (constraint === 'both') {
    pool.sort((a, b) => {
      const w = (a.weight_category || '').localeCompare(b.weight_category || '');
      return w !== 0 ? w : (a.age_category || '').localeCompare(b.age_category || '');
    });
  }

  pool = shuffle(pool);

  // Special case: exactly 2 competitors → single match, no 3rd place
  if (pool.length === 2) {
    return [{
      id: uuid(),
      tournament_id,
      category_id,
      bracket_round: 1,
      blue_competitor_id: pool[0].id,
      red_competitor_id: pool[1].id,
      match_number: 1,
      status: 'pending',
      winner_id: null,
    }];
  }

  const bracket_size = next_power_of_two(pool.length);
  const total_rounds = get_total_rounds(pool.length);
  const matches: Match[] = [];
  let match_number = 1;

  // ── Round 1 ──
  for (let i = 0; i < bracket_size; i += 2) {
    const blue = pool[i];
    const red = pool[i + 1];

    if (blue && red) {
      matches.push({
        id: uuid(), tournament_id, category_id,
        bracket_round: 1,
        blue_competitor_id: blue.id,
        red_competitor_id: red.id,
        match_number: match_number++,
        status: 'pending',
        winner_id: null,
      });
    } else if (blue) {
      // One competitor vs BYE → auto-complete
      matches.push({
        id: uuid(), tournament_id, category_id,
        bracket_round: 1,
        blue_competitor_id: blue.id,
        red_competitor_id: 'BYE',
        match_number: match_number++,
        status: 'completed',
        winner_id: blue.id,
      });
    }
    // If both are undefined (empty bracket slot), no match is created.
    // The cascade_auto_complete function will handle the orphan in the next round.
  }

  // ── Rounds 2+ ──
  let prev_count = Math.ceil(bracket_size / 2);
  for (let round = 2; round <= total_rounds; round++) {
    const count = Math.ceil(prev_count / 2);
    for (let i = 0; i < count; i++) {
      matches.push({
        id: uuid(), tournament_id, category_id,
        bracket_round: round,
        blue_competitor_id: 'TBD',
        red_competitor_id: 'TBD',
        match_number: match_number++,
        status: 'pending',
        winner_id: null,
      });
    }
    prev_count = count;
  }

  // ── 3rd-place match (3+ competitors) ──
  if (pool.length >= 3) {
    matches.push({
      id: uuid(), tournament_id, category_id,
      bracket_round: -1,
      blue_competitor_id: 'TBD',
      red_competitor_id: 'TBD',
      match_number: match_number++,
      status: 'pending',
      winner_id: null,
    });
  }

  // ── Auto-advance BYE winners into next round ──
  const bye_matches = matches.filter(m => m.status === 'completed' && m.red_competitor_id === 'BYE');
  const scoped = get_scoped(matches, tournament_id, category_id);
  for (const bm of bye_matches) {
    const r1 = get_round(scoped, 1);
    const idx = r1.findIndex(m => m.id === bm.id);
    if (idx >= 0) {
      place_winner_in_next_round(scoped, 1, idx, bm.winner_id!);
    }
  }

  // ── Cascade: auto-complete matches with impossible TBDs ──
  cascade_auto_complete(matches, tournament_id, category_id);

  return matches;
}

/* ───────────────── reset scores (no re-draw) ───────────────── */

/**
 * Clear a competitor from the downstream match a completed match fed into,
 * then reset that downstream match and continue clearing along the path.
 * Sibling matches (fed by other sources) are left untouched.
 * Mutates `scoped` in place.
 */
function clear_downstream_path(
  scoped: Match[],
  round: number,
  match_index: number,
  total: number,
): void {
  const next = round + 1;
  if (next > total) return;

  const next_matches = get_round(scoped, next);
  const target_idx = Math.floor(match_index / 2);
  const is_blue = match_index % 2 === 0;
  const nm = next_matches[target_idx];
  if (!nm) return;

  // Empty the slot that the reset match had filled.
  if (is_blue) nm.blue_competitor_id = 'TBD';
  else nm.red_competitor_id = 'TBD';

  const had_advanced = nm.status === 'completed';

  // The downstream match can no longer be considered decided.
  nm.status = 'pending';
  nm.winner_id = null;
  nm.blue_score = undefined;
  nm.red_score = undefined;

  if (had_advanced) {
    const nm_index = next_matches.findIndex(x => x.id === nm.id);
    clear_downstream_path(scoped, next, nm_index, total);
  }
}

/**
 * Reset a SINGLE match's score/result without regenerating the bracket.
 * Clears the match's score and winner (back to "pending"), pulls its
 * advanced competitor out of every downstream match it affected, and, if it
 * was a semifinal, removes its loser from the 3rd-place match.
 *
 * BYE / auto-completed matches cannot be reset (nothing was scored).
 * Returns a NEW array.
 */
export function reset_match_score(matches: Match[], match_id: string): Match[] {
  const updated = matches.map(m => ({ ...m }));
  const target = updated.find(m => m.id === match_id);
  if (!target) return updated;

  // Don't reset BYE / auto-win placeholder matches.
  const has_bye = target.blue_competitor_id === 'BYE' || target.red_competitor_id === 'BYE';
  const has_tbd = target.blue_competitor_id === 'TBD' || target.red_competitor_id === 'TBD';
  if (has_bye || has_tbd) return updated;

  const tid = target.tournament_id;
  const cid = target.category_id;
  const scoped = get_scoped(updated, tid, cid);
  const total = get_total_rounds_from_matches(scoped);
  const round = target.bracket_round;
  const prev_winner = target.winner_id;

  // Reset the target match itself.
  target.status = 'pending';
  target.winner_id = null;
  target.blue_score = undefined;
  target.red_score = undefined;

  if (round > 0) {
    const same_round = get_round(scoped, round);
    const match_index = same_round.findIndex(m => m.id === target.id);
    if (match_index >= 0) {
      clear_downstream_path(scoped, round, match_index, total);
    }

    // Semifinal → pull its loser back out of the 3rd-place match.
    const semifinal_round = total - 1;
    if (round === semifinal_round && semifinal_round >= 1 && prev_winner) {
      const loser_id = target.blue_competitor_id === prev_winner
        ? target.red_competitor_id
        : target.blue_competitor_id;
      const third = scoped.find(m => m.bracket_round === -1);
      if (third && (third.blue_competitor_id === loser_id || third.red_competitor_id === loser_id)) {
        if (third.blue_competitor_id === loser_id) third.blue_competitor_id = 'TBD';
        if (third.red_competitor_id === loser_id) third.red_competitor_id = 'TBD';
        third.status = 'pending';
        third.winner_id = null;
        third.blue_score = undefined;
        third.red_score = undefined;
      }
    }
  }

  return updated;
}

/**
 * Reset ALL scores for a bracket (tournament + category) back to its freshly
 * drawn state WITHOUT re-shuffling the pairings. Round-1 pairings are kept;
 * BYE auto-wins are preserved; every played result is cleared and later
 * rounds return to "TBD / pending". BYE advancement and cascade auto-completion
 * are re-applied so the empty bracket is structurally identical to generation.
 *
 * Returns a NEW array.
 */
export function reset_bracket_scores(
  matches: Match[],
  tid: string | null,
  cid: string | null,
): Match[] {
  const updated = matches.map(m => ({ ...m }));

  for (const m of updated) {
    if (m.tournament_id !== tid || m.category_id !== cid) continue;

    m.blue_score = undefined;
    m.red_score = undefined;

    if (m.bracket_round === 1) {
      // Round 1: keep the pairing. BYE matches stay auto-won.
      if (m.red_competitor_id === 'BYE' || m.blue_competitor_id === 'BYE') {
        const real_id = m.red_competitor_id === 'BYE' ? m.blue_competitor_id : m.red_competitor_id;
        m.status = 'completed';
        m.winner_id = real_id;
      } else {
        m.status = 'pending';
        m.winner_id = null;
      }
    } else {
      // Round 2+ and 3rd place: clear back to placeholders.
      m.blue_competitor_id = 'TBD';
      m.red_competitor_id = 'TBD';
      m.status = 'pending';
      m.winner_id = null;
    }
  }

  // Re-advance BYE winners, then cascade auto-completes (mirrors generation).
  const scoped = get_scoped(updated, tid, cid);
  const bye_matches = scoped.filter(
    m => m.bracket_round === 1 && m.status === 'completed' &&
      (m.red_competitor_id === 'BYE' || m.blue_competitor_id === 'BYE'),
  );
  const r1 = get_round(scoped, 1);
  for (const bm of bye_matches) {
    const idx = r1.findIndex(m => m.id === bm.id);
    if (idx >= 0 && bm.winner_id) {
      place_winner_in_next_round(scoped, 1, idx, bm.winner_id);
    }
  }
  cascade_auto_complete(updated, tid, cid);

  return updated;
}

/**
 * Re-run cascade auto-completion across every bracket. Safe to call on stored
 * data: it only settles impossible-TBD matches and BYE-vs-real 3rd-place
 * matches, repairing brackets that were saved before those fixes existed.
 * Real, playable matches are left untouched. Returns a NEW array.
 */
export function normalize_brackets(matches: Match[]): Match[] {
  const updated = matches.map(m => ({ ...m }));
  const scopes = new Map<string, { tid: string | null; cid: string | null }>();
  for (const m of updated) {
    if (m.bracket_round === 0) continue; // quick matches aren't brackets
    const key = `${m.tournament_id}||${m.category_id}`;
    if (!scopes.has(key)) scopes.set(key, { tid: m.tournament_id, cid: m.category_id });
  }
  for (const { tid, cid } of scopes.values()) {
    if (tid === null) continue;
    cascade_auto_complete(updated, tid, cid);
  }
  return updated;
}

/**
 * Called when a match is finished via the UI. Advances the winner
 * to the next round, places the semifinal loser in the 3rd-place
 * match, and cascades auto-completion for any newly-solvable matches.
 *
 * Returns a NEW array (immutable from the caller's perspective).
 */
export function advance_winner(
  matches: Match[],
  completed_match: Match,
  winner_id: string,
): Match[] {
  const updated = matches.map(m => ({ ...m }));
  const tid = completed_match.tournament_id;
  const cid = completed_match.category_id;
  const round = completed_match.bracket_round;

  if (round < 0) return updated; // 3rd-place match → no further advancement

  const scoped = get_scoped(updated, tid, cid);
  const total = get_total_rounds_from_matches(scoped);
  const same_round = get_round(scoped, round);
  const match_index = same_round.findIndex(m => m.id === completed_match.id);

  // ── 1. Advance winner to next round ──
  place_winner_in_next_round(scoped, round, match_index, winner_id);

  // ── 2. Semifinal loser → 3rd-place match ──
  const semifinal_round = total - 1;
  if (round === semifinal_round && semifinal_round >= 1) {
    const loser_id = completed_match.blue_competitor_id === winner_id
      ? completed_match.red_competitor_id
      : completed_match.blue_competitor_id;
    place_loser_in_third(scoped, loser_id);
  }

  // ── 3. Cascade: auto-complete any newly solvable matches ──
  cascade_auto_complete(updated, tid, cid);

  return updated;
}
