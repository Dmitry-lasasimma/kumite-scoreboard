import React, { useMemo, useState, useEffect } from 'react';
import BracketDisplay from '../components/BracketDisplay';
import { useAppContext } from '../context/AppContext';
import { build_bracket_pdf, build_results_pdf } from '../../services/pdf_export_service';
import type { jsPDF } from 'jspdf';
import type { Competitor } from '../../types/competitor';

export default function BracketDetailView() {
  const {
    tournaments, matches, competitors, tournament_competitors,
    start_match, get_competitor, set_page,
    selected_tournament_id, selected_category_id,
    reset_single_match, reset_bracket,
    edit_move_slot, edit_assign_slot, edit_set_match_score, edit_set_match_winner,
  } = useAppContext();

  const [show_reset, set_show_reset] = useState(false);
  const [confirm_entire, set_confirm_entire] = useState(false);
  const [edit_mode, set_edit_mode] = useState(false);
  type SlotRef = { match_id: string; side: 'blue' | 'red' };
  const [pending_drop, set_pending_drop] = useState<{ from: SlotRef; to: SlotRef } | null>(null);
  const [picker, set_picker] = useState<SlotRef | null>(null);
  const [pdf_preview, set_pdf_preview] = useState<{ url: string; doc: jsPDF; filename: string; title: string } | null>(null);

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

  /** Matches that hold a real score and can therefore be reset. */
  const resettable_matches = useMemo(() => {
    return bracket_matches
      .filter(m => (m.status === 'completed' || m.status === 'in_progress'))
      .filter(m =>
        m.blue_competitor_id !== 'BYE' && m.red_competitor_id !== 'BYE' &&
        m.blue_competitor_id !== 'TBD' && m.red_competitor_id !== 'TBD')
      .sort((a, b) => a.match_number - b.match_number);
  }, [bracket_matches]);

  const has_any_result = bracket_matches.some(m =>
    m.status === 'completed' || m.status === 'in_progress' ||
    typeof m.blue_score === 'number' || typeof m.red_score === 'number');

  const name_of = (id: string) => {
    if (id === 'BYE') return 'BYE';
    if (id === 'TBD') return 'TBD';
    const c = get_competitor(id);
    return c ? `${c.first_name} ${c.last_name}` : 'TBD';
  };

  const match_label = (m: typeof bracket_matches[number]) =>
    m.bracket_round === -1 ? '3rd Place' : `Match ${m.match_number}`;

  const do_reset_entire = () => {
    reset_bracket(selected_tournament_id, selected_category_id);
    set_confirm_entire(false);
    set_show_reset(false);
  };

  /** Seeding = no real results yet (BYE auto-wins don't count). */
  const is_seeding = useMemo(() => {
    return !bracket_matches.some(m => {
      const is_bye = m.blue_competitor_id === 'BYE' || m.red_competitor_id === 'BYE';
      return (m.status === 'completed' && !is_bye) || m.status === 'in_progress'
        || typeof m.blue_score === 'number' || typeof m.red_score === 'number';
    });
  }, [bracket_matches]);

  const handle_slot_drop = (from: SlotRef, to: SlotRef) => {
    if (from.match_id === to.match_id && from.side === to.side) return;
    if (is_seeding) {
      edit_move_slot(from.match_id, from.side, to.match_id, to.side, 'swap');
    } else {
      set_pending_drop({ from, to });   // live: confirm the substitution first
    }
  };

  /** Competitors registered in this tournament + category, sorted by name. */
  const available_competitors = useMemo<Competitor[]>(() => {
    if (!selected_tournament_id) return [];
    const ids = tournament_competitors[selected_tournament_id] || [];
    let comps = ids.map(id => get_competitor(id)).filter(Boolean) as Competitor[];
    if (selected_category_id) comps = comps.filter(c => c.category_id === selected_category_id);
    return comps.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
  }, [selected_tournament_id, selected_category_id, tournament_competitors, get_competitor]);

  /** Competitor IDs already placed in a real slot somewhere in this bracket. */
  const placed_ids = useMemo(() => {
    const s = new Set<string>();
    for (const m of bracket_matches) {
      if (m.blue_competitor_id !== 'TBD' && m.blue_competitor_id !== 'BYE') s.add(m.blue_competitor_id);
      if (m.red_competitor_id !== 'TBD' && m.red_competitor_id !== 'BYE') s.add(m.red_competitor_id);
    }
    return s;
  }, [bracket_matches]);

  const assign_picked = (competitor_id: string) => {
    if (!picker) return;
    edit_assign_slot(picker.match_id, picker.side, competitor_id);
    set_picker(null);
  };

  /** The competitor id currently occupying the slot the picker is open for. */
  const picker_current_id = useMemo(() => {
    if (!picker) return '';
    const m = bracket_matches.find(x => x.id === picker.match_id);
    if (!m) return '';
    return picker.side === 'blue' ? m.blue_competitor_id : m.red_competitor_id;
  }, [picker, bracket_matches]);

  const slot_name = (ref: SlotRef | undefined) => {
    if (!ref) return '';
    const m = bracket_matches.find(x => x.id === ref.match_id);
    if (!m) return '';
    return name_of(ref.side === 'blue' ? m.blue_competitor_id : m.red_competitor_id);
  };

  const confirm_overwrite = () => {
    if (!pending_drop) return;
    const { from, to } = pending_drop;
    edit_move_slot(from.match_id, from.side, to.match_id, to.side, 'overwrite');
    set_pending_drop(null);
  };

  const open_bracket_preview = () => {
    if (!tournament) return;
    const { doc, filename } = build_bracket_pdf(tournament, bracket_matches, competitors, category_name);
    const url = URL.createObjectURL(doc.output('blob'));
    set_pdf_preview({ url, doc, filename, title: 'Bracket PDF — Preview' });
  };

  const open_results_preview = () => {
    if (!tournament) return;
    const { doc, filename } = build_results_pdf(tournament, bracket_matches, competitors, category_name);
    const url = URL.createObjectURL(doc.output('blob'));
    set_pdf_preview({ url, doc, filename, title: 'Results PDF — Preview' });
  };

  const close_preview = () => {
    if (pdf_preview) URL.revokeObjectURL(pdf_preview.url);
    set_pdf_preview(null);
  };

  const save_preview = () => {
    if (!pdf_preview) return;
    pdf_preview.doc.save(pdf_preview.filename);
    close_preview();
  };

  // Revoke the preview blob URL if the page unmounts while it's still open.
  useEffect(() => {
    return () => { if (pdf_preview) URL.revokeObjectURL(pdf_preview.url); };
  }, [pdf_preview]);

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
            onClick={() => set_edit_mode(v => !v)}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${edit_mode
                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
          >
            {edit_mode ? 'Done Editing' : 'Edit Bracket'}
          </button>
          <button
            onClick={() => { set_show_reset(true); set_confirm_entire(false); }}
            disabled={!has_any_result}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${has_any_result
                ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
          >
            Reset Scores
          </button>
          <button
            onClick={open_bracket_preview}
            className="px-4 py-2.5 rounded-xl bg-kumite-blue-50 text-kumite-blue-700 font-semibold text-sm hover:bg-kumite-blue-100 transition-all"
          >
            Export Bracket PDF
          </button>
          <button
            onClick={open_results_preview}
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

      {/* Edit-mode hint */}
      {edit_mode && (
        <div className="shrink-0 mb-3 flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-200 px-4 py-2.5">
          <span className="text-purple-700 text-sm font-semibold">Edit mode</span>
          <span className="text-purple-500 text-xs">
            Drag a competitor onto another slot to {is_seeding ? 'swap them (seeding)' : 'substitute (live — confirm required)'} ·
            type a score · tap <span className="font-semibold">Win</span> to set the winner (advances the bracket).
          </span>
        </div>
      )}

      {/* Bracket display */}
      <div className="flex-2 overflow-auto">
        <BracketDisplay
          matches={bracket_matches}
          competitors={competitors}
          total_rounds={total_rounds}
          on_start_match={start_match}
          get_competitor={get_competitor}
          edit_mode={edit_mode}
          on_slot_drop={handle_slot_drop}
          on_score_change={edit_set_match_score}
          on_pick_winner={edit_set_match_winner}
          on_open_picker={(match_id, side) => set_picker({ match_id, side })}
        />
      </div>

      {/* Competitor picker (edit mode) */}
      {picker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => set_picker(null)}
        >
          <div
            className="card w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900">Select competitor</h3>
                <div className="text-xs text-gray-400">
                  {(() => {
                    const m = bracket_matches.find(x => x.id === picker.match_id);
                    const label = m ? (m.bracket_round === -1 ? '3rd Place' : `Match ${m.match_number}`) : '';
                    return `${label} · ${picker.side === 'blue' ? 'Blue (AO)' : 'Red (AKA)'} slot`;
                  })()}
                </div>
              </div>
              <button onClick={() => set_picker(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">✕</button>
            </div>

            <div className="px-3 py-3 overflow-auto">
              {available_competitors.length === 0 ? (
                <div className="text-sm text-gray-400 italic px-2 py-3">
                  No competitors registered for this {selected_category_id ? 'category' : 'tournament'}.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {available_competitors.map(c => {
                    const placed = placed_ids.has(c.id);
                    const is_current = c.id === picker_current_id;
                    return (
                      <button key={c.id} onClick={() => assign_picked(c.id)}
                        className={`flex items-center justify-between text-left rounded-lg px-3 py-2 transition-all border
                          ${is_current
                            ? 'bg-purple-50 border-purple-300'
                            : 'border-transparent hover:bg-purple-50'}`}>
                        <span className="min-w-0 flex items-center gap-2">
                          {is_current && <span className="text-purple-600 text-xs">✓</span>}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-800 truncate">
                              {c.first_name} {c.last_name}
                            </span>
                            {c.club && <span className="block text-xs text-gray-400 truncate">{c.club}</span>}
                          </span>
                        </span>
                        {is_current ? (
                          <span className="shrink-0 ml-2 text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            current
                          </span>
                        ) : placed && (
                          <span className="shrink-0 ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            already in bracket
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-gray-100 shrink-0">
              <button onClick={() => assign_picked('BYE')}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all">
                Set BYE
              </button>
              <button onClick={() => assign_picked('TBD')}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all">
                Clear (TBD)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF preview modal */}
      {pdf_preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close_preview}
        >
          <div
            className="card w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900">{pdf_preview.title}</h3>
                <div className="text-xs text-gray-400 truncate">{pdf_preview.filename}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={close_preview}
                  className="px-4 py-2 rounded-lg bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button onClick={save_preview}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all">
                  Save PDF…
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 min-h-0">
              <iframe
                title="PDF preview"
                src={`${pdf_preview.url}#toolbar=0&navpanes=0`}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Overwrite (substitution) confirm modal */}
      {pending_drop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => set_pending_drop(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Substitute competitor?</h3>
            <p className="text-sm text-gray-600 mb-5">
              This replaces <span className="font-semibold text-gray-900">{slot_name(pending_drop.to) || 'the empty slot'}</span> with{' '}
              <span className="font-semibold text-gray-900">{slot_name(pending_drop.from)}</span>. Any recorded result for the
              affected match will be cleared.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => set_pending_drop(null)}
                className="px-4 py-2 rounded-lg bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button onClick={confirm_overwrite}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all">
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Scores modal */}
      {show_reset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => set_show_reset(false)}
        >
          <div
            className="card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-900">Reset Scores</h3>
              <button onClick={() => set_show_reset(false)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
                ✕
              </button>
            </div>

            <div className="px-5 py-4 overflow-auto">
              <p className="text-sm text-gray-500 mb-4">
                Clear match results without re-drawing the bracket. Pairings stay the same.
              </p>

              {/* Entire reset */}
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-5">
                <div className="font-semibold text-gray-900 text-sm">Reset entire bracket</div>
                <div className="text-xs text-gray-500 mt-0.5 mb-3">
                  Clears every match score and winner; later rounds return to TBD. Pairings and BYEs are kept.
                </div>
                {confirm_entire ? (
                  <div className="flex gap-2">
                    <button onClick={do_reset_entire}
                      className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 transition-all">
                      Yes, reset everything
                    </button>
                    <button onClick={() => set_confirm_entire(false)}
                      className="px-4 py-2 rounded-lg bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => set_confirm_entire(true)}
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 transition-all">
                    Reset Entire Bracket
                  </button>
                )}
              </div>

              {/* Specific match reset */}
              <div className="font-semibold text-gray-900 text-sm mb-2">Reset a specific match</div>
              {resettable_matches.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-3">No scored matches to reset.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {resettable_matches.map(m => (
                    <div key={m.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {match_label(m)}{m.status === 'in_progress' ? ' · in progress' : ''}
                        </div>
                        <div className="text-sm text-gray-800 truncate">
                          {name_of(m.blue_competitor_id)}
                          <span className="text-gray-300 mx-1.5">vs</span>
                          {name_of(m.red_competitor_id)}
                          {(typeof m.blue_score === 'number' || typeof m.red_score === 'number') && (
                            <span className="ml-2 text-xs text-gray-400 tabular-nums">
                              ({m.blue_score ?? 0}–{m.red_score ?? 0})
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => reset_single_match(m.id)}
                        className="ml-3 shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-orange-100 hover:text-orange-700 transition-all">
                        Reset
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
