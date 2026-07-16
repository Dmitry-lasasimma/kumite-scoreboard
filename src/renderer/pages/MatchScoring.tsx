import React from 'react';
import { useAppContext } from '../context/AppContext';
import { calculate_total, check_auto_win } from '../../services/scorer_service';
import ScoreButton from '../components/ScoreButton';
import TimerControl from '../components/TimerControl';
import PenaltyPanel from '../components/PenaltyPanel';

export default function MatchScoring() {
  const {
    score, is_running, match_status, winner,
    blue_penalties, red_penalties, score_flash,
    handle_score, handle_remove_score, handle_toggle_senshu,
    handle_add_penalty, handle_remove_penalty,
    handle_hajime, handle_stop, handle_resume, handle_reset, handle_end_match,
    handle_time_change,
    current_match, get_competitor, set_page,
  } = useAppContext();

  const blue_comp = current_match ? get_competitor(current_match.blue_competitor_id) : null;
  const red_comp = current_match ? get_competitor(current_match.red_competitor_id) : null;
  const blue_name = blue_comp ? `${blue_comp.first_name} ${blue_comp.last_name}` : 'AO';
  const red_name = red_comp ? `${red_comp.first_name} ${red_comp.last_name}` : 'AKA';
  const blue_club = blue_comp?.club || '';
  const red_club = red_comp?.club || '';

  const blue_total = calculate_total(score, 'blue');
  const red_total = calculate_total(score, 'red');

  const is_quick = current_match?.tournament_id === null;
  const back_page = is_quick ? 'quick_match' : 'bracket_detail';

  if (!current_match) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card p-12 text-center text-gray-400 max-w-md">
          <div className="text-4xl mb-3">⚔</div>
          <div className="font-semibold text-lg">No match selected</div>
          <div className="text-sm mt-1 mb-4">Select a match from the tournament bracket or start a quick match</div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => set_page('bracket')}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
              Go to Bracket
            </button>
            <button onClick={() => set_page('quick_match')}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">
              Quick Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  const round_label = current_match.bracket_round === -1
    ? '3rd Place'
    : `Round ${current_match.bracket_round} · Match ${current_match.match_number}`;

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Operator top bar: match context + bracket navigation */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {!is_quick && (
            <button
              onClick={() => set_page('bracket_detail')}
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all whitespace-nowrap"
            >
              ← View Bracket
            </button>
          )}
          <div className="text-sm font-semibold text-gray-500 truncate">
            {is_quick ? 'Quick Match' : round_label}
          </div>
        </div>
        {!is_quick && match_status === 'active' && (
          <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold uppercase tracking-wider animate-pulse">
            Match live — timer keeps running
          </span>
        )}
      </div>

      {/* Winner Banner */}
      {match_status === 'finished' && (
        <div className={`rounded-2xl p-3 text-center font-score text-xl text-white shadow-xl flex items-center justify-center gap-4 ${
          winner === 'blue' ? 'bg-kumite-blue-600' :
          winner === 'red' ? 'bg-kumite-red-600' :
          'bg-gray-800'
        }`}>
          <span>{winner ? `${winner === 'blue' ? blue_name : red_name} WINS!` : 'DRAW - ZENSHU DECIDES'}</span>
          <button onClick={() => set_page(back_page)}
            className="px-4 py-1.5 rounded-lg bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-all">
            {is_quick ? 'New Quick Match' : 'Back to Bracket'}
          </button>
        </div>
      )}

      {/* Main Scoring Area */}
      <div className="flex-1 grid grid-cols-[1fr_200px_1fr] gap-3 min-h-0">
        {/* Blue Side */}
        <div className={`card p-4 flex flex-col gap-3 border-t-4 border-kumite-blue-500 ${
          score_flash === 'blue' ? 'animate-flash' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-score font-bold text-kumite-blue-700">{blue_name}</div>
              {blue_club && <div className="text-xs text-gray-400">{blue_club}</div>}
            </div>
            <button
              onClick={() => handle_toggle_senshu('blue')}
              title={score.blue_zenshu ? 'Remove Senshu' : 'Give Senshu'}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all
                ${score.blue_zenshu
                  ? 'bg-kumite-blue-600 text-white border-kumite-blue-600 shadow-md'
                  : 'bg-white text-kumite-blue-600 border-kumite-blue-300 hover:bg-kumite-blue-50'}`}>
              Senshu
            </button>
          </div>

          <div className="text-center">
            <div className={`text-7xl font-score font-bold text-kumite-blue-700 leading-none ${
              score_flash === 'blue' ? 'animate-pulse-score' : ''
            }`}>{blue_total}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 flex-1">
            <ScoreButton label="YUKO" value={score.blue_yuko} points="+1" side="blue"
              on_add={() => handle_score('blue', 'yuko')} on_remove={() => handle_remove_score('blue', 'yuko')} />
            <ScoreButton label="WAZA-ARI" value={score.blue_waza_ari} points="+2" side="blue"
              on_add={() => handle_score('blue', 'waza_ari')} on_remove={() => handle_remove_score('blue', 'waza_ari')} />
            <ScoreButton label="IPPON" value={score.blue_ippon} points="+3" side="blue"
              on_add={() => handle_score('blue', 'ippon')} on_remove={() => handle_remove_score('blue', 'ippon')} />
          </div>

          <PenaltyPanel side="blue" penalties={blue_penalties}
            on_add={level => handle_add_penalty('blue', level)}
            on_remove={() => handle_remove_penalty('blue')} />
        </div>

        {/* Center - Timer & Controls */}
        <div className="flex flex-col items-center justify-center gap-3">
          <TimerControl
            time_remaining={score.time_remaining}
            is_running={is_running}
            match_status={match_status}
            on_hajime={handle_hajime}
            on_stop={handle_stop}
            on_resume={handle_resume}
            on_reset={handle_reset}
            on_end_match={handle_end_match}
            on_time_change={handle_time_change}
            end_highlight={check_auto_win(score) !== null}
          />
        </div>

        {/* Red Side */}
        <div className={`card p-4 flex flex-col gap-3 border-t-4 border-kumite-red-500 ${
          score_flash === 'red' ? 'animate-flash' : ''
        }`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => handle_toggle_senshu('red')}
              title={score.red_zenshu ? 'Remove Senshu' : 'Give Senshu'}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all
                ${score.red_zenshu
                  ? 'bg-kumite-red-600 text-white border-kumite-red-600 shadow-md'
                  : 'bg-white text-kumite-red-600 border-kumite-red-300 hover:bg-kumite-red-50'}`}>
              Senshu
            </button>
            <div className="text-right ml-auto">
              <div className="text-xl font-score font-bold text-kumite-red-700">{red_name}</div>
              {red_club && <div className="text-xs text-gray-400">{red_club}</div>}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-7xl font-score font-bold text-kumite-red-700 leading-none ${
              score_flash === 'red' ? 'animate-pulse-score' : ''
            }`}>{red_total}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 flex-1">
            <ScoreButton label="YUKO" value={score.red_yuko} points="+1" side="red"
              on_add={() => handle_score('red', 'yuko')} on_remove={() => handle_remove_score('red', 'yuko')} />
            <ScoreButton label="WAZA-ARI" value={score.red_waza_ari} points="+2" side="red"
              on_add={() => handle_score('red', 'waza_ari')} on_remove={() => handle_remove_score('red', 'waza_ari')} />
            <ScoreButton label="IPPON" value={score.red_ippon} points="+3" side="red"
              on_add={() => handle_score('red', 'ippon')} on_remove={() => handle_remove_score('red', 'ippon')} />
          </div>

          <PenaltyPanel side="red" penalties={red_penalties}
            on_add={level => handle_add_penalty('red', level)}
            on_remove={() => handle_remove_penalty('red')} />
        </div>
      </div>
    </div>
  );
}
