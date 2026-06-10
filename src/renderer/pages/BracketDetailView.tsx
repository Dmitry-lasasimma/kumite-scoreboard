import React, { useMemo } from 'react';
import BracketDisplay from '../components/BracketDisplay';
import { useAppContext } from '../context/AppContext';
import { export_bracket_pdf, export_results_pdf } from '../../services/pdf_export_service';
import { get_total_rounds } from '../../services/bracket_generator';

export default function BracketDetailView() {
  const {
    tournaments, matches, competitors, tournament_competitors,
    start_match, get_competitor, set_page,
    selected_tournament_id, selected_category_id,
  } = useAppContext();

  const tournament = tournaments.find(t => t.id === selected_tournament_id);

  /** Find the category name */
  const category_name = useMemo(() => {
    if (!selected_category_id || !tournament?.categories) return undefined;
    return tournament.categories.find(c => c.id === selected_category_id)?.name;
  }, [selected_category_id, tournament]);

  /** Filter matches for this tournament + category */
  const bracket_matches = useMemo(() => {
    return matches.filter(m =>
      m.tournament_id === selected_tournament_id &&
      m.category_id === selected_category_id
    );
  }, [matches, selected_tournament_id, selected_category_id]);

  /** Get total rounds from actual match data */
  const total_rounds = useMemo(() => {
    const positive = bracket_matches.filter(m => m.bracket_round > 0);
    if (positive.length === 0) return 0;
    return Math.max(...positive.map(m => m.bracket_round));
  }, [bracket_matches]);

  const comp_count = useMemo(() => {
    if (!selected_tournament_id) return 0;
    const comp_ids = tournament_competitors[selected_tournament_id] || [];
    if (selected_category_id) {
      return comp_ids
        .map(id => get_competitor(id))
        .filter(c => c && c.category_id === selected_category_id).length;
    }
    return comp_ids.length;
  }, [selected_tournament_id, selected_category_id, tournament_competitors, get_competitor]);

  const completed_matches = bracket_matches.filter(m => m.status === 'completed').length;
  const total_matches = bracket_matches.length;

  if (!tournament || bracket_matches.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card p-12 text-center text-gray-400 max-w-md">
          <div className="text-4xl mb-3">📊</div>
          <div className="font-semibold text-lg">No bracket found</div>
          <div className="text-sm mt-1 mb-4">Generate a bracket first from the bracket overview page</div>
          <button onClick={() => set_page('bracket')}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
            Back to Brackets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => set_page('bracket')}
            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all">
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {tournament.name}
              {category_name && <span className="text-purple-600 ml-2">— {category_name}</span>}
            </h2>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => export_bracket_pdf(tournament, bracket_matches, competitors, category_name)}
            className="px-4 py-2.5 rounded-xl bg-kumite-blue-50 text-kumite-blue-700 font-semibold text-sm hover:bg-kumite-blue-100 transition-all"
          >
            Export Bracket PDF
          </button>
          <button
            onClick={() => export_results_pdf(tournament, bracket_matches, competitors, category_name)}
            className="px-4 py-2.5 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-all"
          >
            Export Results PDF
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex gap-3 mb-4 shrink-0">
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
          {comp_count} competitors
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold capitalize">
          {tournament.pairing_constraint.replace('_', ' ')} pairing
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold">
          {bracket_matches.filter(m => m.status === 'pending').length} pending
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">
          {completed_matches} / {total_matches} completed
        </span>
      </div>

      {/* Bracket display */}
      <div className="flex-2 overflow-auto">
        <BracketDisplay
          matches={bracket_matches}
          competitors={competitors}
          total_rounds={total_rounds}
          on_start_match={start_match}
          get_competitor={get_competitor}
        />
      </div>
    </div>
  );
}
