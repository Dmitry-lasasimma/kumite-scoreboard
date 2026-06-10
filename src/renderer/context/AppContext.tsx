import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Competitor } from '../../types/competitor';
import { Tournament } from '../../types/tournament';
import { Match } from '../../types/match';
import { MatchScore, PenaltyLevel, Side, ScoreType } from '../../types/score';
import { add_score, remove_score, calculate_total, check_auto_win, determine_winner, apply_penalty_zenshu } from '../../services/scorer_service';
import { DEFAULT_DURATION } from '../../utils/constants';
import { generate_bracket, advance_winner } from '../../services/bracket_generator';
import { v4 as uuid } from 'uuid';

export type Page = 'home' | 'tournament_setup' | 'competitors' | 'bracket' | 'bracket_detail' | 'scoring' | 'quick_match';

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
  handle_add_penalty: (side: Side, level: PenaltyLevel) => void;
  handle_remove_penalty: (side: Side) => void;
  handle_hajime: () => void;
  handle_stop: () => void;
  handle_resume: () => void;
  handle_reset: () => void;
  handle_time_change: (seconds: number) => void;
  handle_finish_match: (winner_side: Side) => void;

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [page, set_page] = useState<Page>('home');
  const [tournaments, set_tournaments] = useState<Tournament[]>([]);
  const [competitors, set_competitors] = useState<Competitor[]>([]);
  const [tournament_competitors, set_tc] = useState<Record<string, string[]>>({});
  const [matches, set_matches] = useState<Match[]>([]);
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

  useEffect(() => {
    broadcast_to_spectator({
      score,
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
      get_blue_name, get_red_name, get_blue_club, get_red_club]);

  useEffect(() => {
    if (is_running && score.time_remaining > 0) {
      timer_ref.current = setInterval(() => {
        set_score(prev => {
          const next = { ...prev, time_remaining: prev.time_remaining - 1 };
          if (next.time_remaining <= 0) {
            set_is_running(false);
            set_match_status('finished');
            const w = determine_winner(next);
            set_winner(w);
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

  const start_match = useCallback((match: Match) => {
    set_current_match(match);
    set_score(create_empty_score());
    set_is_running(false);
    set_match_status('idle');
    set_winner(null);
    set_blue_penalties([]);
    set_red_penalties([]);
    set_matches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'in_progress' as const } : m));
    set_page('scoring');
  }, []);

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
      const auto = check_auto_win(updated);
      if (auto) {
        set_is_running(false);
        set_match_status('finished');
        set_winner(auto);
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

  const handle_add_penalty = useCallback((side: Side, level: PenaltyLevel) => {
    if (match_status === 'finished') return;
    if (side === 'blue') set_blue_penalties(prev => [...prev, level]);
    else set_red_penalties(prev => [...prev, level]);
    set_score(prev => apply_penalty_zenshu(prev, side, level));
    if (level === '5H') {
      const other: Side = side === 'blue' ? 'red' : 'blue';
      set_is_running(false);
      set_match_status('finished');
      set_winner(other);
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

  const handle_finish_match = useCallback((winner_side: Side) => {
    if (!current_match) return;
    if (current_match.tournament_id === null) return; // quick match

    const winner_id = winner_side === 'blue' ? current_match.blue_competitor_id : current_match.red_competitor_id;
    set_matches(prev => {
      const completed = prev.map(m =>
        m.id === current_match.id ? { ...m, status: 'completed' as const, winner_id } : m
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
      handle_finish_match(winner);
    }
  }, [match_status, winner, current_match, handle_finish_match]);

  const value: AppState = {
    page, set_page,
    tournaments, add_tournament, update_tournament, delete_tournament,
    selected_tournament_id, set_selected_tournament_id,
    selected_category_id, set_selected_category_id,
    competitors, add_competitor, update_competitor, delete_competitor,
    tournament_competitors, add_competitor_to_tournament, remove_competitor_from_tournament,
    matches, generate_tournament_bracket, generate_category_bracket,
    current_match, start_match, start_quick_match,
    score, is_running, match_status, winner,
    blue_penalties, red_penalties, score_flash,
    handle_score, handle_remove_score,
    handle_add_penalty, handle_remove_penalty,
    handle_hajime, handle_stop, handle_resume, handle_reset,
    handle_time_change, handle_finish_match,
    get_competitor, get_tournament,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
