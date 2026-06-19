import React, { useState, useEffect } from 'react';
import ScoreDisplay from './components/ScoreDisplay';
import TimerDisplay from './components/TimerDisplay';
import PenaltyDisplay from './components/PenaltyDisplay';
import CompetitorInfo from './components/CompetitorInfo';
import { MatchScore, PenaltyLevel, Side } from '../types/score';
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
  match_status: 'idle' | 'active' | 'finished';
  winner: Side | null;
}

const DEFAULT_DATA: SpectatorData = {
  score: {
    id: '', match_id: '', duration_minutes: 3,
    time_remaining: DEFAULT_DURATION,
    blue_ippon: 0, blue_waza_ari: 0, blue_yuko: 0,
    red_ippon: 0, red_waza_ari: 0, red_yuko: 0,
    blue_zenshu: false, red_zenshu: false,
  },
  category: '',
  blue_name: 'AO', red_name: 'AKA',
  blue_club: '', red_club: '',
  blue_penalties: [], red_penalties: [],
  blue_total: 0, red_total: 0,
  is_running: false, match_status: 'idle', winner: null,
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
          is_running, match_status, winner } = data;

  return (
    <div className="h-screen w-screen flex bg-black overflow-hidden relative">
      {/* Blue Side */}
      <div className="flex-1 bg-gradient-to-br from-kumite-blue-600 to-kumite-blue-800 flex flex-col justify-between p-6 relative">
        <CompetitorInfo name={blue_name} club={blue_club} side="blue" has_zenshu={score.blue_zenshu} />
        <ScoreDisplay total={blue_total} score={score} side="blue" />
        <PenaltyDisplay penalties={blue_penalties} side="blue" />
      </div>

      {/* Center Timer */}
      <div className="w-48 flex flex-col items-center justify-center bg-black relative">
        {category && (
          <div className="mb-4 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest text-center max-w-[11rem] truncate border border-white/20">
            {category}
          </div>
        )}
        <TimerDisplay time_remaining={score.time_remaining} is_running={is_running} />

        {(score.blue_zenshu || score.red_zenshu) && (
          <div className={`mt-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest
            ${score.blue_zenshu
              ? 'bg-kumite-blue-500/30 text-kumite-blue-300 border border-kumite-blue-400/30'
              : 'bg-kumite-red-500/30 text-kumite-red-300 border border-kumite-red-400/30'}`}>
            Senshu
          </div>
        )}

        {match_status === 'finished' && winner && (
          <div className={`mt-4 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-center
            ${winner === 'blue' ? 'bg-kumite-blue-500 text-white' : 'bg-kumite-red-500 text-white'}`}>
            {winner === 'blue' ? blue_name : red_name}<br />WINS
          </div>
        )}

        {match_status === 'idle' && (
          <div className="mt-4 text-gray-600 text-xs uppercase tracking-widest font-semibold">
            Waiting
          </div>
        )}
      </div>

      {/* Red Side */}
      <div className="flex-1 bg-gradient-to-bl from-kumite-red-600 to-kumite-red-800 flex flex-col justify-between p-6 relative">
        <CompetitorInfo name={red_name} club={red_club} side="red" has_zenshu={score.red_zenshu} />
        <ScoreDisplay total={red_total} score={score} side="red" />
        <PenaltyDisplay penalties={red_penalties} side="red" />
      </div>
    </div>
  );
}
