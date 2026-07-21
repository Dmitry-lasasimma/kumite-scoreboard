import React, { useState, useEffect } from 'react';
import ScoreDisplay from './components/ScoreDisplay';
import TimerDisplay from './components/TimerDisplay';
import PenaltyDisplay from './components/PenaltyDisplay';
import CompetitorInfo from './components/CompetitorInfo';
import { MatchScore, PenaltyLevel, Side, MatchStatus, WinReason, ClockAnchor } from '../types/score';
import { DEFAULT_DURATION } from '../utils/constants';

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
  clock_anchor: ClockAnchor | null;
  match_status: MatchStatus;
  winner: Side | null;
  win_reason: WinReason;
}

const WIN_REASON_LABELS: Record<string, string> = {
  senshu: 'Senshu',
  advanced_technique: 'Advanced Technique',
  hantei: 'Hantei',
  disqualification: 'Hansoku',
};

const DEFAULT_DATA: SpectatorData = {
  score: {
    id: '', match_id: '', duration_minutes: 3,
    time_remaining: DEFAULT_DURATION,
    blue_ippon: 0, blue_waza_ari: 0, blue_yuko: 0,
    red_ippon: 0, red_waza_ari: 0, red_yuko: 0,
    blue_zenshu: false, red_zenshu: false,
    blue_flags: 0, red_flags: 0,
  },
  category: '',
  blue_name: 'AO', red_name: 'AKA',
  blue_club: '', red_club: '',
  blue_penalties: [], red_penalties: [],
  blue_total: 0, red_total: 0,
  is_running: false, clock_anchor: null, match_status: 'idle', winner: null, win_reason: 'none',
};

export default function App() {
  const [data, set_data] = useState<SpectatorData>(DEFAULT_DATA);

  useEffect(() => {
    const bc = new BroadcastChannel('kumite-scoreboard');
    bc.onmessage = (event) => {
      if (event.data?.type === 'spectator-update' && event.data.data) {
        set_data(event.data.data);
      }
    };

    const kumite = (window as any).kumiteAPI;
    if (kumite) {
      kumite.on('score-updated', (incoming: SpectatorData) => {
        set_data(incoming);
      });
    }

    return () => {
      bc.close();
      if (kumite) kumite.removeAllListeners('score-updated');
    };
  }, []);

  const { score, category, blue_name, red_name, blue_club, red_club,
          blue_penalties, red_penalties, blue_total, red_total,
          is_running, clock_anchor, match_status, winner, win_reason } = data;

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden relative">
      {/* ── Clock band: the timer owns the full width so it reads from the back
             of the hall. Category sits above it, match state below. ── */}
      <div className="shrink-0 flex flex-col items-center justify-center pt-[1.5vh] pb-[1vh]"
           style={{ minHeight: '29vh' }}>
        {category && (
          <div className="mb-[1vh] px-[2vw] py-[0.5vh] rounded-full bg-white/10 border border-white/20
                          text-white/80 font-bold uppercase tracking-[0.35em] text-center truncate max-w-[70vw]"
               style={{ fontSize: 'min(2.2vh, 1.6vw)' }}>
            {category}
          </div>
        )}

        <TimerDisplay
          time_remaining={score.time_remaining}
          is_running={is_running}
          clock_anchor={clock_anchor ?? null}
          is_hantei={match_status === 'hantei'}
        />
      </div>

      {/* ── Result / state strip ── */}
      {match_status === 'finished' && winner && (
        <div className={`shrink-0 flex items-center justify-center gap-[2vw] py-[1.2vh]
          ${winner === 'blue' ? 'bg-kumite-blue-500' : 'bg-kumite-red-500'}`}>
          <span className="text-white font-score font-bold uppercase tracking-[0.15em] truncate max-w-[60vw]"
                style={{ fontSize: 'min(4.5vh, 3.4vw)' }}>
            {winner === 'blue' ? blue_name : red_name} wins
          </span>
          {WIN_REASON_LABELS[win_reason] && (
            <span className="text-white/80 font-bold uppercase tracking-[0.3em]"
                  style={{ fontSize: 'min(2.2vh, 1.6vw)' }}>
              {WIN_REASON_LABELS[win_reason]}
            </span>
          )}
        </div>
      )}

      {match_status === 'hantei' && (
        <div className="shrink-0 bg-yellow-400 py-[1.2vh] text-center">
          <span className="text-gray-900 font-score font-bold uppercase tracking-[0.3em]"
                style={{ fontSize: 'min(4vh, 3vw)' }}>
            Hantei — Judges’ Decision
          </span>
        </div>
      )}

      {/* ── Competitors ── */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 bg-gradient-to-br from-kumite-blue-600 to-kumite-blue-800
                        flex flex-col gap-[2.5vh] pt-[2vh] px-[2vh] pb-[3vh] relative min-w-0">
          <CompetitorInfo name={blue_name} club={blue_club} side="blue" />
          <ScoreDisplay total={blue_total} score={score} side="blue" has_zenshu={score.blue_zenshu} />
          <PenaltyDisplay penalties={blue_penalties} side="blue" />
          {/* Absorbs the leftover height, so the group above sits high on the
              panel instead of being spread out to the bottom edge. */}
          <div className="flex-1 min-h-0" aria-hidden />
        </div>

        <div className="w-[3px] bg-black" />

        <div className="flex-1 bg-gradient-to-bl from-kumite-red-600 to-kumite-red-800
                        flex flex-col gap-[2.5vh] pt-[2vh] px-[2vh] pb-[3vh] relative min-w-0">
          <CompetitorInfo name={red_name} club={red_club} side="red" />
          <ScoreDisplay total={red_total} score={score} side="red" has_zenshu={score.red_zenshu} />
          <PenaltyDisplay penalties={red_penalties} side="red" />
          <div className="flex-1 min-h-0" aria-hidden />
        </div>
      </div>

      {match_status === 'idle' && (
        <div className="absolute bottom-[1.5vh] left-1/2 -translate-x-1/2 text-white/25
                        uppercase tracking-[0.4em] font-semibold pointer-events-none"
             style={{ fontSize: 'min(1.8vh, 1.4vw)' }}>
          Waiting
        </div>
      )}
    </div>
  );
}
