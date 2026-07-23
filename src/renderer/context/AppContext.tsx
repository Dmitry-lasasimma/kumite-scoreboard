import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Competitor } from '../../types/competitor';
import { Tournament } from '../../types/tournament';
import { Match } from '../../types/match';
import { MatchScore, PenaltyLevel, Side, ScoreType, MatchStatus, WinReason, OperatorNotification, ClockAnchor } from '../../types/score';
import { add_score, remove_score, calculate_total, check_auto_win, determine_winner, toggle_senshu, award_disqualification, resolve_outcome, add_flag, remove_flag, clear_flags, penalty_threatens_senshu, is_first_score_of_match } from '../../services/scorer_service';
import { DEFAULT_DURATION, DISQUALIFYING_PENALTIES, NOTIFICATION_AUTO_DISMISS_MS, TIMER_CRITICAL_SECONDS, CLOCK_TICK_MS } from '../../utils/constants';
import { play_short_beep, play_long_beep } from '../../utils/sounds';
import { generate_bracket, advance_winner, reset_match_score, reset_bracket_scores, normalize_brackets, migrate_to_categories } from '../../services/bracket_generator';
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
    blue_flags: 0, red_flags: 0,
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
  /** The running clock, or null when stopped. Lets the display compute the
   *  exact remaining time itself rather than reading a sampled value. */
  clock_anchor: ClockAnchor | null;
  match_status: MatchStatus;
  winner: Side | null;
  win_reason: WinReason;
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
  /** Bulk entry from a spreadsheet import — see import_competitors. */
  import_competitors: (
    tournament_id: string,
    new_competitors: Competitor[],
    existing_ids: string[],
  ) => void;
  update_competitor: (c: Competitor) => void;
  delete_competitor: (id: string) => void;

  tournament_competitors: Record<string, string[]>;
  add_competitor_to_tournament: (tournament_id: string, competitor_id: string) => void;
  remove_competitor_from_tournament: (tournament_id: string, competitor_id: string) => void;

  matches: Match[];
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
  clock_anchor: ClockAnchor | null;
  match_status: MatchStatus;
  winner: Side | null;
  win_reason: WinReason;
  blue_penalties: PenaltyLevel[];
  red_penalties: PenaltyLevel[];
  score_flash: Side | null;
  /** Scoring input is locked while the clock runs, to prevent stray taps. */
  scoring_locked: boolean;
  /** Senshu reminders shown to the operator on the scoring screen. */
  notifications: OperatorNotification[];
  dismiss_notification: (id: string) => void;

  handle_score: (side: Side, type: ScoreType) => void;
  handle_remove_score: (side: Side, type: ScoreType) => void;
  handle_toggle_senshu: (side: Side) => void;
  handle_add_penalty: (side: Side, level: PenaltyLevel) => void;
  handle_remove_penalty: (side: Side) => void;
  handle_add_flag: (side: Side) => void;
  handle_remove_flag: (side: Side) => void;
  handle_clear_flags: () => void;
  handle_confirm_hantei: () => void;
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

// One long-lived channel. Opening and closing a BroadcastChannel per message
// costs a handle each time and can discard the message that was just posted —
// which matters now the clock publishes many times a second.
let spectator_channel: BroadcastChannel | null = null;

function get_spectator_channel(): BroadcastChannel | null {
  if (spectator_channel) return spectator_channel;
  try {
    spectator_channel = new BroadcastChannel('kumite-scoreboard');
  } catch {
    spectator_channel = null;
  }
  return spectator_channel;
}

function broadcast_to_spectator(data: SpectatorData) {
  try {
    const kumite = (window as any).kumiteAPI;
    if (kumite) {
      kumite.send('score-updated', data);
    }
  } catch {}

  try {
    get_spectator_channel()?.postMessage({ type: 'spectator-update', data });
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

/**
 * Read everything back from storage and bring it up to the current data rules
 * in one pass, so the collections stay consistent with each other.
 */
function load_initial_data() {
  return migrate_to_categories({
    tournaments: load_stored<Tournament[]>('kumite_tournaments', []),
    competitors: load_stored<Competitor[]>('kumite_competitors', []),
    tournament_competitors: load_stored<Record<string, string[]>>('kumite_tc', {}),
    matches: normalize_brackets(load_stored<Match[]>('kumite_matches', [])),
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(load_initial_data, []);
  const [page, set_page] = useState<Page>('home');
  const [tournaments, set_tournaments] = useState<Tournament[]>(initial.tournaments);
  const [competitors, set_competitors] = useState<Competitor[]>(initial.competitors);
  const [tournament_competitors, set_tc] = useState<Record<string, string[]>>(initial.tournament_competitors);
  const [matches, set_matches] = useState<Match[]>(initial.matches);
  const [selected_tournament_id, set_selected_tournament_id] = useState<string | null>(null);
  const [selected_category_id, set_selected_category_id] = useState<string | null>(null);

  const [current_match, set_current_match] = useState<Match | null>(null);
  const [score, set_score] = useState<MatchScore>(create_empty_score);
  const [is_running, set_is_running] = useState(false);
  const [clock_anchor, set_clock_anchor] = useState<ClockAnchor | null>(null);
  const [match_status, set_match_status] = useState<MatchStatus>('idle');
  const [winner, set_winner] = useState<Side | null>(null);
  const [win_reason, set_win_reason] = useState<WinReason>('none');
  const [blue_penalties, set_blue_penalties] = useState<PenaltyLevel[]>([]);
  const [red_penalties, set_red_penalties] = useState<PenaltyLevel[]>([]);
  const [score_flash, set_score_flash] = useState<Side | null>(null);
  const [notifications, set_notifications] = useState<OperatorNotification[]>([]);
  const timer_ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const notification_timeout_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifications_ref = useRef<OperatorNotification[]>([]);
  const time_ref = useRef<number>(DEFAULT_DURATION);

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
      clock_anchor,
      match_status,
      winner,
      win_reason,
    });
  }, [score, blue_penalties, red_penalties, is_running, clock_anchor, match_status, winner, win_reason,
      get_blue_name, get_red_name, get_blue_club, get_red_club, get_category_label]);

  // Mirror of the clock so the countdown can read the remaining time on resume
  // without re-subscribing every tick.
  useEffect(() => { time_ref.current = score.time_remaining; }, [score.time_remaining]);

  /**
   * Match clock. The remaining time is derived from the wall clock rather than
   * counted down a second at a time, so it carries sub-second precision and
   * cannot drift over a three-minute round. Pausing therefore captures the true
   * fractional remainder (12.47s, not 12s), which is what the spectator display
   * shows in the closing seconds.
   */
  useEffect(() => {
    if (!is_running) { set_clock_anchor(null); return; }
    const started_from = time_ref.current;
    if (started_from <= 0) { set_clock_anchor(null); return; }
    const started_at = Date.now();
    let warned = started_from < TIMER_CRITICAL_SECONDS + 1;
    let expired = false;

    // Publish where the clock started rather than only what it currently reads,
    // so every window can derive the exact remaining time for itself.
    set_clock_anchor({ from: started_from, at: started_at });

    timer_ref.current = setInterval(() => {
      const elapsed = (Date.now() - started_at) / 1000;
      const remaining = Math.max(0, started_from - elapsed);

      // Fire as soon as the displayed second first reaches the critical mark
      // (e.g. the instant the clock shows 00:15.99, not a full second later
      // when it's about to roll over to 00:14).
      if (!warned && remaining < TIMER_CRITICAL_SECONDS + 1) {
        warned = true;
        play_short_beep();
      }
      set_score(prev => ({ ...prev, time_remaining: remaining }));

      if (remaining <= 0 && !expired) {
        expired = true;
        // Time is up: stop the clock and sound the long time-up horn
        // automatically, but keep the match ACTIVE. The referee must still
        // officially end the match (or add extra time and resume) before a
        // winner is declared. See handle_end_match.
        set_is_running(false);
        play_long_beep();
      }
    }, CLOCK_TICK_MS);

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

  /**
   * Apply a reviewed spreadsheet import in one step: create the new
   * competitors and enter both them and the already-registered ones into the
   * tournament. Existing competitors are never modified, so someone already
   * drawn into another tournament keeps their category there.
   */
  const import_competitors = useCallback((
    tournament_id: string,
    new_competitors: Competitor[],
    existing_ids: string[],
  ) => {
    if (new_competitors.length > 0) {
      set_competitors(prev => [...prev, ...new_competitors]);
    }
    const all_ids = [...new_competitors.map(c => c.id), ...existing_ids];
    if (all_ids.length === 0) return;
    set_tc(prev => {
      const current = prev[tournament_id] || [];
      const merged = [...current];
      for (const id of all_ids) if (!merged.includes(id)) merged.push(id);
      return { ...prev, [tournament_id]: merged };
    });
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

  /**
   * Draw a bracket for one category. Categories are the pairing rule, so this
   * is the only way a bracket is created.
   */
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
    const bracket = generate_bracket(comps, tid, category_id, t.third_place_mode);
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
    set_win_reason('none');
    set_blue_penalties([]);
    set_red_penalties([]);
    set_notifications([]);
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
    set_win_reason('none');
    set_blue_penalties([]);
    set_red_penalties([]);
    set_notifications([]);
    set_page('scoring');
  }, []);

  // Scores and penalties may only be entered while the clock is stopped. The
  // referee always calls YAME before awarding anything, so this guards against
  // stray taps registering during live action.
  const scoring_locked = is_running;

  /* ── Operator reminders ── */

  const push_notification = useCallback((n: Omit<OperatorNotification, 'id'>) => {
    // Only one reminder of each kind is useful at a time — the newest wins.
    set_notifications(prev => [...prev.filter(x => x.kind !== n.kind), { ...n, id: uuid() }]);
  }, []);

  const dismiss_notification = useCallback((id: string) => {
    set_notifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const side_name = useCallback((side: Side) => (
    side === 'blue' ? get_blue_name() : get_red_name()
  ), [get_blue_name, get_red_name]);

  // A reminder disappears the moment the operator resolves it: awarding Senshu
  // to either side settles the "award" reminder, and taking Senshu off the
  // penalised competitor settles the "revoke" one.
  useEffect(() => {
    set_notifications(prev => {
      const next = prev.filter(n => {
        if (n.kind === 'senshu_award') return !score.blue_zenshu && !score.red_zenshu;
        if (n.kind === 'senshu_revoke') return n.side === 'blue' ? score.blue_zenshu : score.red_zenshu;
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [score.blue_zenshu, score.red_zenshu]);

  // Keep a live handle on the reminders without making the auto-dismiss effect
  // depend on them — the countdown must start on TSUZUKETE, not on every change.
  useEffect(() => { notifications_ref.current = notifications; }, [notifications]);

  /**
   * Auto-dismiss runs only while the match is actually being fought: the clock
   * starting (HAJIME / TSUZUKETE) begins the countdown, and only the reminders
   * that were on screen at that moment are cleared. Stopping the clock cancels
   * the countdown, so a reminder raised during a stoppage always gets its full
   * time and is never killed by a timer left over from an earlier round.
   */
  useEffect(() => {
    if (notification_timeout_ref.current) {
      clearTimeout(notification_timeout_ref.current);
      notification_timeout_ref.current = null;
    }
    if (!is_running) return;
    const pending_ids = notifications_ref.current.map(n => n.id);
    if (pending_ids.length === 0) return;
    notification_timeout_ref.current = setTimeout(() => {
      set_notifications(prev => prev.filter(n => !pending_ids.includes(n.id)));
      notification_timeout_ref.current = null;
    }, NOTIFICATION_AUTO_DISMISS_MS);
  }, [is_running]);

  useEffect(() => () => {
    if (notification_timeout_ref.current) clearTimeout(notification_timeout_ref.current);
  }, []);

  const handle_score = useCallback((side: Side, type: ScoreType) => {
    if (match_status === 'finished' || match_status === 'hantei') return;
    if (is_running) return;

    // First point of the match: remind the operator that Senshu may be due.
    if (is_first_score_of_match(score)) {
      push_notification({
        kind: 'senshu_award',
        side,
        title: `Senshu — ${side_name(side)}?`,
        message: 'First point of the match. Award Senshu if the point was unopposed, using the Senshu badge above the score.',
      });
    }

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
  }, [match_status, is_running, score, push_notification, side_name]);

  const handle_remove_score = useCallback((side: Side, type: ScoreType) => {
    if (match_status === 'finished' || match_status === 'hantei') return;
    if (is_running) return;
    set_score(prev => remove_score(prev, side, type));
  }, [match_status, is_running]);

  const handle_toggle_senshu = useCallback((side: Side) => {
    if (match_status === 'finished' || match_status === 'hantei') return;
    if (is_running) return;
    set_score(prev => toggle_senshu(prev, side));
  }, [match_status, is_running]);

  const handle_add_penalty = useCallback((side: Side, level: PenaltyLevel) => {
    if (match_status === 'finished' || match_status === 'hantei') return;
    if (is_running) return;
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
      set_win_reason('disqualification');
      play_long_beep(); // disqualification ends the match decisively
    } else if (penalty_threatens_senshu(score, side, level)) {
      // HC against the Senshu holder. Senshu is NOT removed automatically —
      // the operator is reminded and makes the call.
      push_notification({
        kind: 'senshu_revoke',
        side,
        title: `Take back Senshu — ${side_name(side)}?`,
        message: 'HC penalty against the Senshu holder. Tap the Senshu badge to take it back if the referee revoked it.',
      });
    }
  }, [match_status, is_running, score, push_notification, side_name]);

  const handle_remove_penalty = useCallback((side: Side) => {
    if (match_status === 'finished' || match_status === 'hantei') return;
    if (is_running) return;
    if (side === 'blue') set_blue_penalties(prev => prev.slice(0, -1));
    else set_red_penalties(prev => prev.slice(0, -1));
  }, [match_status, is_running]);

  /* ── Hantei (judges' flags) ── */

  const handle_add_flag = useCallback((side: Side) => {
    if (match_status !== 'hantei') return;
    set_score(prev => add_flag(prev, side));
  }, [match_status]);

  const handle_remove_flag = useCallback((side: Side) => {
    if (match_status !== 'hantei') return;
    set_score(prev => remove_flag(prev, side));
  }, [match_status]);

  const handle_clear_flags = useCallback(() => {
    if (match_status !== 'hantei') return;
    set_score(prev => clear_flags(prev));
  }, [match_status]);

  /**
   * Confirm the judges' vote. The flags have already been added to each side's
   * score, so the normal resolution now produces a winner. A split that is
   * still level (an even number of flags) leaves the vote open.
   */
  const handle_confirm_hantei = useCallback(() => {
    if (match_status !== 'hantei') return;
    const outcome = resolve_outcome(score);
    if (!outcome.winner) return;
    set_match_status('finished');
    set_winner(outcome.winner);
    set_win_reason(outcome.reason);
    play_long_beep();
  }, [match_status, score]);

  const handle_hajime = useCallback(() => {
    if (match_status === 'finished' || match_status === 'hantei') return;
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
    set_win_reason('none');
    set_blue_penalties([]);
    set_red_penalties([]);
    set_notifications([]);
  }, []);

  const handle_time_change = useCallback((seconds: number) => {
    set_score(prev => ({ ...prev, time_remaining: seconds }));
  }, []);

  /**
   * Officially end the match on the referee's command. Stops the clock and
   * runs the decision sequence: points → Senshu → most advanced technique.
   * If none of those separate the competitors the match moves to HANTEI and
   * waits for the judges' flags instead of finishing.
   */
  const handle_end_match = useCallback((silent?: boolean) => {
    if (match_status !== 'active') return;
    set_is_running(false);
    const outcome = resolve_outcome(score);
    if (outcome.needs_hantei) {
      set_match_status('hantei');
      set_score(prev => clear_flags(prev));
      if (!silent) play_long_beep();
      return;
    }
    set_match_status('finished');
    set_winner(outcome.winner);
    set_win_reason(outcome.reason);
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
    competitors, add_competitor, import_competitors, update_competitor, delete_competitor,
    tournament_competitors, add_competitor_to_tournament, remove_competitor_from_tournament,
    matches, generate_category_bracket,
    reset_single_match, reset_bracket,
    edit_move_slot, edit_assign_slot, edit_set_match_score, edit_set_match_winner,
    current_match, start_match, start_quick_match,
    score, is_running, clock_anchor, match_status, winner, win_reason,
    blue_penalties, red_penalties, score_flash, scoring_locked,
    notifications, dismiss_notification,
    handle_score, handle_remove_score, handle_toggle_senshu,
    handle_add_penalty, handle_remove_penalty,
    handle_add_flag, handle_remove_flag, handle_clear_flags, handle_confirm_hantei,
    handle_hajime, handle_stop, handle_resume, handle_reset, handle_end_match,
    handle_time_change, handle_finish_match,
    get_competitor, get_tournament,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
