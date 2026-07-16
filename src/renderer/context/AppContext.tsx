import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Competitor } from '../../types/competitor';
import { Tournament } from '../../types/tournament';
import { Match } from '../../types/match';
import { MatchScore, PenaltyLevel, Side, ScoreType } from '../../types/score';
import { add_score, remove_score, calculate_total, check_auto_win, determine_winner, apply_penalty_zenshu, toggle_senshu, award_disqualification } from '../../services/scorer_service';
import { DEFAULT_DURATION, DISQUALIFYING_PENALTIES } from '../../utils/constants';
import { play_short_beep, play_long_beep } from '../../utils/sounds';
import { generate_bracket, advance_winner, reset_match_score, reset_bracket_scores, normalize_brackets } from '../../services/bracket_generator';
import { v4 as uuid } from 'uuid';

export type Page = 'home' | 'tournament_setup' | 'competitors' | 'bracket' | 'bracket_detail' | 'scoring' | 'quick_match' | 'about';

function create_empty_score(): MatchScore {
  return {
    id: uuid(),
    match_id: '',
    duration_minutes: 3,
    time_remaining: DEFAULT_DURATION,
    blue_ippon: 0, blue_waza_ari: 0, blue_yuko: 0,
    red_ippon: 0, red_waza_ari: 0, red_yuko: 0,
    blue_zenshu: false, red_zenshu: false,
  };
}

interface SpectatorData {
  score: MatchScore;
  category: string;
  blue_name: string;
  red_name: string;
  blue_club: string;
  red_club: string;
  blue_penalties: PenaltyLevel[];
  red_penalties: PenaltyLevel[];
  blue_total: number;
  red_total: number;
  is_running: boolean;
  match_status: 'idle' | 'active' | 'finished';
  winner: Side | null;
}

interface AppState {
  page: Page;
  set_page: (page: Page) => void;

  tournaments: Tournament[];
  add_tournament: (t: Tournament) => void;
  update_tournament: (t: Tournament) => void;
  delete_tournament: (id: string) => void;
  selected_tournament_id: string | null;
  set_selected_tournament_id: (id: string | null) => void;
  selected_category_id: string | null;
  set_selected_category_id: (id: string | null) => void;

  competitors: Competitor[];
  add_competitor: (c: Competitor) => void;
  update_competitor: (c: Competitor) => void;
  delete_competitor: (id: string) => void;

  tournament_competitors: Record<string, string[]>;
  add_competitor_to_tournament: (tournament_id: string, competitor_id: string) => void;
  remove_competitor_from_tournament: (tournament_id: string, competitor_id: string) => void;

  matches: Match[];
  generate_tournament_bracket: (tournament_id: string) => void;
  generate_category_bracket: (tournament_id: string, category_id: string) => void;
  reset_single_match: (match_id: string) => void;
  reset_bracket: (tournament_id: string | null, category_id: string | null) => void;
  edit_move_slot: (from_match_id: string, from_side: Side, to_match_id: string, to_side: Side, mode: 'swap' | 'overwrite') => void;
  edit_assign_slot: (match_id: string, side: Side, competitor_id: string) => void;
  edit_set_match_score: (match_id: string, side: Side, value: number | undefined) => void;
  edit_set_match_winner: (match_id: string, winner_id: string | null) => void;

  current_match: Match | null;
  start_match: (match: Match) => void;
  start_quick_match: () => void;

  score: MatchScore;
  is_running: boolean;
  match_status: 'idle' | 'active' | 'finished';
  winner: Side | null;
  blue_penalties: PenaltyLevel[];
  red_penalties: PenaltyLevel[];
  score_flash: Side | null;

  handle_score: (side: Side, type: ScoreType) => void;
  handle_remove_score: (side: Side, type: ScoreType) => void;
  handle_toggle_senshu: (side: Side) => void;
  handle_add_penalty: (side: Side, level: PenaltyLevel) => void;
  handle_remove_penalty: (side: Side) => void;
  handle_hajime: () => void;
  handle_stop: () => void;
  handle_resume: () => void;
  handle_reset: () => void;
  handle_end_match: (silent?: boolean) => void;
  handle_time_change: (seconds: number) => void;
  handle_finish_match: (winner_side: Side, blue_score: number, red_score: number) => void;

  get_competitor: (id: string) => Competitor | undefined;
  get_tournament: (id: string) => Tournament | undefined;
}

const AppContext = createContext<AppState | null>(null);

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

function broadcast_to_spectator(data: SpectatorData) {
  try {
    const kumite = (window as any).kumiteAPI;
    if (kumite) {
      kumite.send('score-updated', data);
    }
  } catch {}

  try {
    const bc = new BroadcastChannel('kumite-scoreboard');
    bc.postMessage({ type: 'spectator-update', data });
    bc.close();
  } catch {}
}

function load_stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save_stored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [page, set_page] = useState<Page>('home');
  const [tournaments, set_tournaments] = useState<Tournament[]>(() => load_stored('kumite_tournaments', []));
  const [competitors, set_competitors] = useState<Competitor[]>(() => load_stored('kumite_competitors', []));
  const [tournament_competitors, set_tc] = useState<Record<string, string[]>>(() => load_stored('kumite_tc', {}));
  const [matches, set_matches] = useState<Match[]>(() => normalize_brackets(load_stored('kumite_matches', [])));
  const [selected_tournament_id, set_selected_tournament_id] = useState<string | null>(null);
  const [selected_category_id, set_selected_category_id] = useState<string | null>(null);

  const [current_match, set_current_match] = useState<Match | null>(null);
  const [score, set_score] = useState<MatchScore>(create_empty_score);
  const [is_running, set_is_running] = useState(false);
  const [match_status, set_match_status] = useState<'idle' | 'active' | 'finished'>('idle');
  const [winner, set_winner] = useState<Side | null>(null);
  const [blue_penalties, set_blue_penalties] = useState<PenaltyLevel[]>([]);
  const [red_penalties, set_red_penalties] = useState<PenaltyLevel[]>([]);
  const [score_flash, set_score_flash] = useState<Side | null>(null);
  const timer_ref = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist to localStorage on change
  useEffect(() => { save_stored('kumite_tournaments', tournaments); }, [tournaments]);
  useEffect(() => { save_stored('kumite_competitors', competitors); }, [competitors]);
  useEffect(() => { save_stored('kumite_tc', tournament_competitors); }, [tournament_competitors]);
  useEffect(() => { save_stored('kumite_matches', matches); }, [matches]);

  const get_competitor = useCallback((id: string) => competitors.find(c => c.id === id), [competitors]);
  const get_tournament = useCallback((id: string) => tournaments.find(t => t.id === id), [tournaments]);

  const get_blue_name = useCallback(() => {
    if (!current_match) return 'AO';
    if (current_match.tournament_id === null) return 'AO';
    const c = get_competitor(current_match.blue_competitor_id);
    return c ? `${c.first_name} ${c.last_name}` : 'AO';
  }, [current_match, get_competitor]);

  const get_red_name = useCallback(() => {
    if (!current_match) return 'AKA';
    if (current_match.tournament_id === null) return 'AKA';
    const c = get_competitor(current_match.red_competitor_id);
    return c ? `${c.first_name} ${c.last_name}` : 'AKA';
  }, [current_match, get_competitor]);

  const get_blue_club = useCallback(() => {
    if (!current_match || current_match.tournament_id === null) return '';
    const c = get_competitor(current_match.blue_competitor_id);
    return c ? c.club : '';
  }, [current_match, get_competitor]);

  const get_red_club = useCallback(() => {
    if (!current_match || current_match.tournament_id === null) return '';
    const c = get_competitor(current_match.red_competitor_id);
    return c ? c.club : '';
  }, [current_match, get_competitor]);

  const get_category_label = useCallback(() => {
    if (!current_match || current_match.tournament_id === null) return '';
    const t = tournaments.find(x => x.id === current_match.tournament_id);
    if (current_match.category_id && t) {
      const cat = (t.categories || []).find(c => c.id === current_match.category_id);
      if (cat) return cat.name;
    }
    return t ? t.name : '';
  }, [current_match, tournaments]);

  useEffect(() => {
    broadcast_to_spectator({
      score,
      category: get_category_label(),
      blue_name: get_blue_name(),
      red_name: get_red_name(),
      blue_club: get_blue_club(),
      red_club: get_red_club(),
      blue_penalties,
      red_penalties,
      blue_total: calculate_total(score, 'blue'),
      red_total: calculate_total(score, 'red'),
      is_running,
      match_status,
      winner,
    });
  }, [score, blue_penalties, red_penalties, is_running, match_status, winner,
      get_blue_name, get_red_name, get_blue_club, get_red_club, get_category_label]);

  useEffect(() => {
    if (is_running && score.time_remaining > 0) {
      timer_ref.current = setInterval(() => {
        set_score(prev => {
          const next = { ...prev, time_remaining: prev.time_remaining - 1 };
          if (next.time_remaining === 15) {
            play_short_beep();
          }
          if (next.time_remaining <= 0) {
            // Time is up: stop the clock and sound the long time-up horn
            // automatically, but keep the match ACTIVE. The referee must still
            // officially end the match (or add extra time and resume) before a
            // winner is declared. See handle_end_match.
            set_is_running(false);
            play_long_beep();
          }
          return next;
        });
      }, 1000);
    }
    return () => { if (timer_ref.current) clearInterval(timer_ref.current); };
  }, [is_running]);

  const add_tournament = useCallback((t: Tournament) => {
    set_tournaments(prev => [...prev, t]);
    set_tc(prev => ({ ...prev, [t.id]: [] }));
  }, []);

  const update_tournament = useCallback((t: Tournament) => {
    set_tournaments(prev => prev.map(x => x.id === t.id ? t : x));
  }, []);

  const delete_tournament = useCallback((id: string) => {
    set_tournaments(prev => prev.filter(t => t.id !== id));
    set_tc(prev => { const n = { ...prev }; delete n[id]; return n; });
    set_matches(prev => prev.filter(m => m.tournament_id !== id));
    if (selected_tournament_id === id) set_selected_tournament_id(null);
  }, [selected_tournament_id]);

  const add_competitor = useCallback((c: Competitor) => {
    set_competitors(prev => [...prev, c]);
  }, []);

  const update_competitor = useCallback((c: Competitor) => {
    set_competitors(prev => prev.map(x => x.id === c.id ? c : x));
  }, []);

  const delete_competitor = useCallback((id: string) => {
    set_competitors(prev => prev.filter(c => c.id !== id));
    set_tc(prev => {
      const n = { ...prev };
      for (const tid of Object.keys(n)) {
        n[tid] = n[tid].filter(cid => cid !== id);
      }
      return n;
    });
  }, []);

  const add_competitor_to_tournament = useCallback((tid: string, cid: string) => {
    set_tc(prev => {
      const list = prev[tid] || [];
      if (list.includes(cid)) return prev;
      return { ...prev, [tid]: [...list, cid] };
    });
  }, []);

  const remove_competitor_from_tournament = useCallback((tid: string, cid: string) => {
    set_tc(prev => ({ ...prev, [tid]: (prev[tid] || []).filter(id => id !== cid) }));
  }, []);

  const generate_tournament_bracket = useCallback((tid: string) => {
    const t = tournaments.find(x => x.id === tid);
    if (!t) return;
    const comp_ids = tournament_competitors[tid] || [];
    const comps = comp_ids.map(id => competitors.find(c => c.id === id)).filter(Boolean) as Competitor[];
    if (comps.length < 2) return;

    set_matches(prev => prev.filter(m => m.tournament_id !== tid));
    const bracket = generate_bracket(comps, tid, t.pairing_constraint, null);
    set_matches(prev => [...prev, ...bracket]);
    set_tournaments(prev => prev.map(x => x.id === tid ? { ...x, status: 'in_progress' as const } : x));
  }, [tournaments, tournament_competitors, competitors]);

  const generate_category_bracket = useCallback((tid: string, category_id: string) => {
    const t = tournaments.find(x => x.id === tid);
    if (!t) return;
    const comp_ids = tournament_competitors[tid] || [];
    const comps = comp_ids
      .map(id => competitors.find(c => c.id === id))
      .filter(Boolean)
      .filter(c => (c as Competitor).category_id === category_id) as Competitor[];
    if (comps.length < 2) return;

    set_matches(prev => prev.filter(m => !(m.tournament_id === tid && m.category_id === category_id)));
    const bracket = generate_bracket(comps, tid, t.pairing_constraint, category_id);
    set_matches(prev => [...prev, ...bracket]);
    set_tournaments(prev => prev.map(x => x.id === tid ? { ...x, status: 'in_progress' as const } : x));
  }, [tournaments, tournament_competitors, competitors]);

  const reset_single_match = useCallback((match_id: string) => {
    let tid: string | null = null;
    set_matches(prev => {
      const target = prev.find(m => m.id === match_id);
      tid = target ? target.tournament_id : null;
      return reset_match_score(prev, match_id);
    });
    // A reset re-opens the bracket, so the tournament is no longer completed.
    if (tid) set_tournaments(tp => tp.map(t => t.id === tid && t.status === 'completed'
      ? { ...t, status: 'in_progress' as const } : t));
    // If the reset match is the one loaded in the scoring view, drop it.
    set_current_match(prev => (prev && prev.id === match_id ? null : prev));
  }, []);

  const reset_bracket = useCallback((tid: string | null, cid: string | null) => {
    set_matches(prev => reset_bracket_scores(prev, tid, cid));
    if (tid) set_tournaments(tp => tp.map(t => t.id === tid && t.status === 'completed'
      ? { ...t, status: 'in_progress' as const } : t));
    set_current_match(prev => (prev && prev.tournament_id === tid && prev.category_id === cid ? null : prev));
  }, []);

  /* ── Manual bracket editing ── */

  const set_slot = (m: Match, side: Side, value: string): Match =>
    side === 'blue' ? { ...m, blue_competitor_id: value } : { ...m, red_competitor_id: value };

  // Clear a match's played result (used after re-arranging competitors).
  const clear_result = (m: Match): Match => ({
    ...m, status: 'pending', winner_id: null, blue_score: undefined, red_score: undefined,
  });

  const edit_move_slot = useCallback((
    from_id: string, from_side: Side, to_id: string, to_side: Side, mode: 'swap' | 'overwrite',
  ) => {
    if (from_id === to_id && from_side === to_side) return;
    set_matches(prev => {
      const from_m = prev.find(x => x.id === from_id);
      const to_m = prev.find(x => x.id === to_id);
      if (!from_m || !to_m) return prev;
      const from_comp = from_side === 'blue' ? from_m.blue_competitor_id : from_m.red_competitor_id;
      const to_comp = to_side === 'blue' ? to_m.blue_competitor_id : to_m.red_competitor_id;

      return prev.map(x => {
        // Both slots live in the same match.
        if (x.id === from_id && from_id === to_id) {
          let nx = { ...x };
          if (mode === 'swap') {
            nx = set_slot(nx, from_side, to_comp);
            nx = set_slot(nx, to_side, from_comp);
          } else {
            nx = set_slot(nx, to_side, from_comp);
            nx = set_slot(nx, from_side, 'TBD');
          }
          return clear_result(nx);
        }
        if (x.id === to_id) {
          return clear_result(set_slot({ ...x }, to_side, from_comp));
        }
        if (x.id === from_id) {
          // swap → receives target's competitor; overwrite → vacated.
          return clear_result(set_slot({ ...x }, from_side, mode === 'swap' ? to_comp : 'TBD'));
        }
        return x;
      });
    });
  }, []);

  // Assign a specific competitor (or 'BYE' / 'TBD') to a slot and clear the
  // match's played result. Used by the edit-mode competitor picker.
  const edit_assign_slot = useCallback((match_id: string, side: Side, competitor_id: string) => {
    set_matches(prev => prev.map(m =>
      m.id === match_id ? clear_result(set_slot({ ...m }, side, competitor_id)) : m));
  }, []);

  const edit_set_match_score = useCallback((match_id: string, side: Side, value: number | undefined) => {
    set_matches(prev => prev.map(m => m.id === match_id
      ? { ...m, ...(side === 'blue' ? { blue_score: value } : { red_score: value }) }
      : m));
  }, []);

  const edit_set_match_winner = useCallback((match_id: string, winner_id: string | null) => {
    set_matches(prev => {
      const m = prev.find(x => x.id === match_id);
      if (!m) return prev;
      if (winner_id === null) {
        return prev.map(x => x.id === match_id ? { ...x, winner_id: null, status: 'pending' as const } : x);
      }
      const completed = prev.map(x => x.id === match_id
        ? { ...x, status: 'completed' as const, winner_id } : x);
      const fm = completed.find(x => x.id === match_id)!;
      return advance_winner(completed, fm, winner_id);
    });
  }, []);

  const start_match = useCallback((match: Match) => {
    // Use the tournament's configured match time so the operator doesn't have
    // to pick a duration every time a match starts.
    const t = match.tournament_id ? tournaments.find(x => x.id === match.tournament_id) : null;
    const dur = t?.default_duration ?? DEFAULT_DURATION;
    const base = create_empty_score();
    set_current_match(match);
    set_score({ ...base, time_remaining: dur, duration_minutes: Math.max(1, Math.round(dur / 60)) });
    set_is_running(false);
    set_match_status('idle');
    set_winner(null);
    set_blue_penalties([]);
    set_red_penalties([]);
    // Keep the bracket selection in sync so "View Bracket" returns to this bracket.
    set_selected_tournament_id(match.tournament_id);
    set_selected_category_id(match.category_id);
    set_matches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'in_progress' as const } : m));
    set_page('scoring');
  }, [tournaments]);

  const start_quick_match = useCallback(() => {
    const quick: Match = {
      id: uuid(),
      tournament_id: null,
      category_id: null,
      bracket_round: 1,
      blue_competitor_id: 'QUICK_AO',
      red_competitor_id: 'QUICK_AKA',
      match_number: 0,
      status: 'in_progress',
      winner_id: null,
    };
    set_current_match(quick);
    set_score(create_empty_score());
    set_is_running(false);
    set_match_status('idle');
    set_winner(null);
    set_blue_penalties([]);
    set_red_penalties([]);
    set_page('scoring');
  }, []);

  const handle_score = useCallback((side: Side, type: ScoreType) => {
    if (match_status === 'finished') return;
    set_score(prev => {
      const updated = add_score(prev, side, type);
      const prev_auto = check_auto_win(prev);
      const auto = check_auto_win(updated);
      // 8-point lead reached: stop the clock and sound the long beep to signal
      // the win condition, but DO NOT finish yet — the referee must officially
      // end the match (they may add time or review before confirming).
      if (auto && !prev_auto) {
        set_is_running(false);
        play_long_beep();
      }
      return updated;
    });
    set_score_flash(side);
    setTimeout(() => set_score_flash(null), 400);
  }, [match_status]);

  const handle_remove_score = useCallback((side: Side, type: ScoreType) => {
    if (match_status === 'finished') return;
    set_score(prev => remove_score(prev, side, type));
  }, [match_status]);

  const handle_toggle_senshu = useCallback((side: Side) => {
    if (match_status === 'finished') return;
    set_score(prev => toggle_senshu(prev, side));
  }, [match_status]);

  const handle_add_penalty = useCallback((side: Side, level: PenaltyLevel) => {
    if (match_status === 'finished') return;
    if (side === 'blue') set_blue_penalties(prev => [...prev, level]);
    else set_red_penalties(prev => [...prev, level]);

    const is_disqualifying = (DISQUALIFYING_PENALTIES as readonly string[]).includes(level);
    if (is_disqualifying) {
      // HANSOKU (H) or SHIKKAKU (S): zero the offender, set opponent to 8, opponent wins.
      const other: Side = side === 'blue' ? 'red' : 'blue';
      set_score(prev => award_disqualification(prev, side));
      set_is_running(false);
      set_match_status('finished');
      set_winner(other);
      play_long_beep(); // disqualification ends the match decisively
    } else {
      set_score(prev => apply_penalty_zenshu(prev, side, level));
    }
  }, [match_status]);

  const handle_remove_penalty = useCallback((side: Side) => {
    if (side === 'blue') set_blue_penalties(prev => prev.slice(0, -1));
    else set_red_penalties(prev => prev.slice(0, -1));
  }, []);

  const handle_hajime = useCallback(() => {
    if (match_status === 'finished') return;
    set_match_status('active');
    set_is_running(true);
  }, [match_status]);

  const handle_stop = useCallback(() => set_is_running(false), []);

  const handle_resume = useCallback(() => {
    if (score.time_remaining > 0 && match_status !== 'finished') set_is_running(true);
  }, [score.time_remaining, match_status]);

  const handle_reset = useCallback(() => {
    set_score(create_empty_score());
    set_is_running(false);
    set_match_status('idle');
    set_winner(null);
    set_blue_penalties([]);
    set_red_penalties([]);
  }, []);

  const handle_time_change = useCallback((seconds: number) => {
    set_score(prev => ({ ...prev, time_remaining: seconds }));
  }, []);

  /**
   * Officially end the match on the referee's command. Stops the clock,
   * determines the winner from the current score (with Senshu as tie-breaker)
   * and marks the match finished. Used when time is up or the referee declares
   * a decision.
   */
  const handle_end_match = useCallback((silent?: boolean) => {
    if (match_status !== 'active') return;
    set_is_running(false);
    set_match_status('finished');
    set_winner(determine_winner(score));
    // Normal end sounds the long beep; a silent end declares the winner quietly.
    if (!silent) play_long_beep();
  }, [match_status, score]);

  const handle_finish_match = useCallback((winner_side: Side, blue_score: number, red_score: number) => {
    if (!current_match) return;
    if (current_match.tournament_id === null) return; // quick match

    const winner_id = winner_side === 'blue' ? current_match.blue_competitor_id : current_match.red_competitor_id;
    set_matches(prev => {
      const completed = prev.map(m =>
        m.id === current_match.id ? { ...m, status: 'completed' as const, winner_id, blue_score, red_score } : m
      );
      const finished_match = completed.find(m => m.id === current_match.id)!;
      const advanced = advance_winner(completed, finished_match, winner_id);

      const t_id = current_match.tournament_id;
      const cat_id = current_match.category_id;
      const relevant = advanced.filter(m => m.tournament_id === t_id && m.category_id === cat_id && m.bracket_round > 0);
      const all_done = relevant.every(m => m.status === 'completed');
      const third_place = advanced.find(m => m.tournament_id === t_id && m.category_id === cat_id && m.bracket_round === -1);
      const all_including_3rd = all_done && (!third_place || third_place.status === 'completed');

      if (all_including_3rd) {
        const all_t_matches = advanced.filter(m => m.tournament_id === t_id);
        const tournament_done = all_t_matches.every(m => m.status === 'completed');
        if (tournament_done) {
          set_tournaments(tp => tp.map(t => t.id === t_id ? { ...t, status: 'completed' as const } : t));
        }
      }

      return advanced;
    });
  }, [current_match]);

  useEffect(() => {
    if (match_status === 'finished' && winner && current_match) {
      handle_finish_match(winner, calculate_total(score, 'blue'), calculate_total(score, 'red'));
    }
  }, [match_status, winner, current_match, handle_finish_match, score]);

  // Note: the long beep is triggered explicitly at each end path — time-up
  // (auto), 8-point lead, disqualification, and a NORMAL "End Match". A SILENT
  // "End Match" declares the winner without any sound.

  const value: AppState = {
    page, set_page,
    tournaments, add_tournament, update_tournament, delete_tournament,
    selected_tournament_id, set_selected_tournament_id,
    selected_category_id, set_selected_category_id,
    competitors, add_competitor, update_competitor, delete_competitor,
    tournament_competitors, add_competitor_to_tournament, remove_competitor_from_tournament,
    matches, generate_tournament_bracket, generate_category_bracket,
    reset_single_match, reset_bracket,
    edit_move_slot, edit_assign_slot, edit_set_match_score, edit_set_match_winner,
    current_match, start_match, start_quick_match,
    score, is_running, match_status, winner,
    blue_penalties, red_penalties, score_flash,
    handle_score, handle_remove_score, handle_toggle_senshu,
    handle_add_penalty, handle_remove_penalty,
    handle_hajime, handle_stop, handle_resume, handle_reset, handle_end_match,
    handle_time_change, handle_finish_match,
    get_competitor, get_tournament,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
