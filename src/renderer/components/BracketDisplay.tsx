import React from 'react';
import { Match } from '../../types/match';
import { Competitor } from '../../types/competitor';
import { get_semifinal_losers } from '../../services/bracket_generator';

type SlotSide = 'blue' | 'red';
interface SlotRef { match_id: string; side: SlotSide; }

interface BracketDisplayProps {
  matches: Match[];
  competitors: Competitor[];
  total_rounds: number;
  on_start_match: (match: Match) => void;
  get_competitor: (id: string) => Competitor | undefined;
  edit_mode?: boolean;
  on_slot_drop?: (from: SlotRef, to: SlotRef) => void;
  on_score_change?: (match_id: string, side: SlotSide, value: number | undefined) => void;
  on_pick_winner?: (match_id: string, winner_id: string | null) => void;
  on_open_picker?: (match_id: string, side: SlotSide) => void;
}

/** Card height in px (fixed for line calculations) */
const CARD_H = 110;
/** Width of each match card */
const CARD_W = 288;
/** Width of the connector lines area */
const LINE_W = 48;
/** Vertical gap between R1 cards */
const CARD_GAP = 12;

function get_name(id: string, get_competitor: (id: string) => Competitor | undefined): string {
  if (id === 'BYE') return 'BYE';
  if (id === 'TBD') return 'TBD';
  const c = get_competitor(id);
  return c ? `${c.first_name} ${c.last_name}` : 'TBD';
}

function get_club(id: string, get_competitor: (id: string) => Competitor | undefined): string {
  if (id === 'BYE' || id === 'TBD') return '';
  const c = get_competitor(id);
  return c ? c.club : '';
}

function is_real_competitor(id: string): boolean {
  return id !== 'BYE' && id !== 'TBD';
}

/** One competitor row inside a match card (blue or red). */
function CompetitorRow({
  match, side, get_competitor, edit_mode, on_slot_drop, on_score_change, on_pick_winner, on_open_picker,
}: {
  match: Match;
  side: SlotSide;
  get_competitor: (id: string) => Competitor | undefined;
  edit_mode: boolean;
  on_slot_drop?: (from: SlotRef, to: SlotRef) => void;
  on_score_change?: (match_id: string, side: SlotSide, value: number | undefined) => void;
  on_pick_winner?: (match_id: string, winner_id: string | null) => void;
  on_open_picker?: (match_id: string, side: SlotSide) => void;
}) {
  const id = side === 'blue' ? match.blue_competitor_id : match.red_competitor_id;
  const score = side === 'blue' ? match.blue_score : match.red_score;
  const is_real = is_real_competitor(id);
  const is_tbd = id === 'TBD';
  const is_winner = match.winner_id === id && is_real;
  const border = side === 'blue' ? 'border-kumite-blue-500' : 'border-kumite-red-500';
  const win_bg = side === 'blue' ? 'bg-kumite-blue-50' : 'bg-kumite-red-50';
  const dot = side === 'blue' ? 'bg-kumite-blue-500' : 'bg-kumite-red-500';
  const win_text = side === 'blue' ? 'text-kumite-blue-600' : 'text-kumite-red-600';
  const win_chip = side === 'blue' ? 'bg-kumite-blue-100' : 'bg-kumite-red-100';
  const score_text = side === 'blue' ? 'text-kumite-blue-700' : 'text-kumite-red-700';

  return (
    <div
      onDragOver={edit_mode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
      onDrop={edit_mode ? (e) => {
        e.preventDefault();
        try {
          const from = JSON.parse(e.dataTransfer.getData('text/plain')) as SlotRef;
          if (from && from.match_id) on_slot_drop?.(from, { match_id: match.id, side });
        } catch { /* ignore malformed drag */ }
      } : undefined}
      className={`flex items-center px-3 py-2 gap-2 border-l-4 ${border}
        ${is_winner ? win_bg : 'bg-white'}
        ${edit_mode ? 'ring-1 ring-inset ring-gray-100' : ''}`}
    >
      {/* Empty slot in edit mode → "Add competitor" picker button */}
      {edit_mode && !is_real ? (
        <button
          onClick={() => on_open_picker?.(match.id, side)}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-sm font-semibold text-purple-600 hover:text-purple-700"
        >
          <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs leading-none">+</span>
          {id === 'BYE' ? 'BYE — tap to change' : 'Add competitor'}
        </button>
      ) : (
        <>
          {/* Drag handle + name (tap to change, drag to move) */}
          <div
            draggable={edit_mode && is_real}
            onDragStart={edit_mode && is_real ? (e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({ match_id: match.id, side }));
              e.dataTransfer.effectAllowed = 'move';
            } : undefined}
            onClick={edit_mode && is_real ? () => on_open_picker?.(match.id, side) : undefined}
            className={`flex items-center gap-2 flex-1 min-w-0 ${edit_mode && is_real ? 'cursor-pointer' : ''}`}
            title={edit_mode && is_real ? 'Tap to change · drag to move' : undefined}
          >
            {edit_mode && is_real && (
              <span className="text-gray-300 text-xs leading-none select-none">⠿</span>
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm truncate ${is_tbd ? 'text-gray-300' : 'text-gray-900'}`}>
                {get_name(id, get_competitor)}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {get_club(id, get_competitor)}
              </div>
            </div>
          </div>
          {edit_mode && is_real && (
            <button
              onClick={() => on_open_picker?.(match.id, side)}
              title="Replace competitor"
              className="shrink-0 w-6 h-6 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all text-xs"
            >
              ▾
            </button>
          )}
        </>
      )}

      {edit_mode ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            value={typeof score === 'number' ? score : ''}
            disabled={!is_real}
            onChange={(e) => {
              const v = e.target.value;
              on_score_change?.(match.id, side, v === '' ? undefined : Math.max(0, Number(v)));
            }}
            placeholder="–"
            className={`w-12 text-center text-sm font-score font-bold rounded-md border px-1 py-0.5 outline-none
              ${is_real ? 'border-gray-200 text-gray-800 focus:border-gray-900' : 'border-gray-100 text-gray-300 bg-gray-50'}`}
          />
          <button
            onClick={() => on_pick_winner?.(match.id, is_winner ? null : id)}
            disabled={!is_real}
            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
              ${is_winner
                ? `${win_chip} ${win_text}`
                : is_real
                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
            title={is_winner ? 'Clear winner' : 'Set as winner'}
          >
            {is_winner ? 'Win ✓' : 'Win'}
          </button>
        </div>
      ) : (
        <>
          {match.status === 'completed' && typeof score === 'number' && (
            <span className={`text-sm font-score font-bold ${score_text} tabular-nums`}>{score}</span>
          )}
          {is_winner && (
            <span className={`text-xs font-bold ${win_text} ${win_chip} px-2 py-0.5 rounded`}>WIN</span>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({
  match, get_competitor, on_start_match,
  edit_mode = false, on_slot_drop, on_score_change, on_pick_winner, on_open_picker,
}: {
  match: Match;
  get_competitor: (id: string) => Competitor | undefined;
  on_start_match: (match: Match) => void;
  edit_mode?: boolean;
  on_slot_drop?: (from: SlotRef, to: SlotRef) => void;
  on_score_change?: (match_id: string, side: SlotSide, value: number | undefined) => void;
  on_pick_winner?: (match_id: string, winner_id: string | null) => void;
  on_open_picker?: (match_id: string, side: SlotSide) => void;
}) {
  const has_bye = match.blue_competitor_id === 'BYE' || match.red_competitor_id === 'BYE';
  const can_start = match.status === 'pending'
    && !has_bye
    && match.blue_competitor_id !== 'TBD' && match.red_competitor_id !== 'TBD';
  const is_active = match.status === 'in_progress';
  const is_done = match.status === 'completed';
  const is_bye_win = is_done && has_bye;
  const is_waiting = !is_done && (match.blue_competitor_id === 'TBD' || match.red_competitor_id === 'TBD');

  return (
    <div
      className={`card p-0 overflow-hidden shadow-md transition-all
        ${is_active ? 'ring-2 ring-green-500 shadow-green-100' : ''}
        ${edit_mode ? 'ring-2 ring-purple-300' : ''}
        ${!edit_mode && can_start ? 'hover:shadow-xl cursor-pointer' : ''}
        ${is_waiting && !edit_mode ? 'opacity-40' : ''}`}
      style={{ width: CARD_W, minHeight: CARD_H }}
      onClick={() => !edit_mode && can_start && on_start_match(match)}
    >
      <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider flex justify-between
        ${is_done ? 'bg-gray-100 text-gray-500'
          : is_active ? 'bg-green-50 text-green-700'
          : can_start ? 'bg-yellow-50 text-yellow-700'
          : 'bg-gray-50 text-gray-400'}`}>
        <span>
          {match.bracket_round === -1 ? '3rd Place' : `Match ${match.match_number}`}
        </span>
        <span>
          {edit_mode ? 'Editing'
            : is_bye_win ? 'BYE' : is_done ? 'Completed' : is_active ? 'In Progress' : can_start ? 'Click to Start' : 'Waiting'}
        </span>
      </div>

      <CompetitorRow match={match} side="blue" get_competitor={get_competitor}
        edit_mode={edit_mode} on_slot_drop={on_slot_drop}
        on_score_change={on_score_change} on_pick_winner={on_pick_winner} on_open_picker={on_open_picker} />

      <div className="h-px bg-gray-100" />

      <CompetitorRow match={match} side="red" get_competitor={get_competitor}
        edit_mode={edit_mode} on_slot_drop={on_slot_drop}
        on_score_change={on_score_change} on_pick_winner={on_pick_winner} on_open_picker={on_open_picker} />
    </div>
  );
}

/**
 * Calculate the vertical center Y position of each match card.
 * Round 1 is evenly spaced; subsequent rounds center between their two sources.
 */
function compute_card_centers(round: number, count: number, all_centers: Map<number, number[]>): number[] {
  if (round === 1) {
    const gap = CARD_H + CARD_GAP;
    return Array.from({ length: count }, (_, i) => i * gap);
  }

  const prev = all_centers.get(round - 1);
  if (!prev) return Array.from({ length: count }, (_, i) => i * (CARD_H + CARD_GAP));

  const centers: number[] = [];
  for (let i = 0; i < count; i++) {
    const top_idx = i * 2;
    const bot_idx = i * 2 + 1;
    const top = prev[top_idx] ?? 0;
    const bot = prev[bot_idx] ?? top;
    centers.push((top + bot) / 2);
  }
  return centers;
}

/**
 * SVG connector lines between two rounds.
 */
function ConnectorLines({ prev_centers, next_centers, height }: {
  prev_centers: number[];
  next_centers: number[];
  height: number;
}) {
  const half_card = CARD_H / 2;
  const paths: string[] = [];
  const mid_x = LINE_W / 2;

  for (let i = 0; i < next_centers.length; i++) {
    const top_idx = i * 2;
    const bot_idx = i * 2 + 1;
    const target_y = next_centers[i] + half_card;

    if (top_idx < prev_centers.length) {
      const src_y = prev_centers[top_idx] + half_card;
      paths.push(`M 0 ${src_y} H ${mid_x} V ${target_y} H ${LINE_W}`);
    }
    if (bot_idx < prev_centers.length) {
      const src_y = prev_centers[bot_idx] + half_card;
      paths.push(`M 0 ${src_y} H ${mid_x} V ${target_y} H ${LINE_W}`);
    }
  }

  return (
    <svg width={LINE_W} height={height} className="shrink-0">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#d1d5db" strokeWidth={2} />
      ))}
    </svg>
  );
}

export default function BracketDisplay({
  matches, competitors, total_rounds, on_start_match, get_competitor,
  edit_mode = false, on_slot_drop, on_score_change, on_pick_winner, on_open_picker,
}: BracketDisplayProps) {
  const third_place = matches.find(m => m.bracket_round === -1);
  const has_third = !!third_place;
  const semifinal_round = total_rounds > 1 ? total_rounds - 1 : 0;

  // With two bronze medals there is no 3rd-place match to draw, so the beaten
  // semi-finalists are listed in its place once they are known.
  const bronze_ids = has_third ? [] : get_semifinal_losers(matches);
  const has_bronze_panel = !has_third && total_rounds > 1;

  const card_props = { edit_mode, on_slot_drop, on_score_change, on_pick_winner, on_open_picker };

  // Build round data
  const rounds_data: { round: number; matches: Match[] }[] = [];
  for (let r = 1; r <= total_rounds; r++) {
    const round_matches = matches
      .filter(m => m.bracket_round === r)
      .sort((a, b) => a.match_number - b.match_number);
    rounds_data.push({ round: r, matches: round_matches });
  }

  // Compute vertical centers for each round
  const all_centers = new Map<number, number[]>();
  for (const rd of rounds_data) {
    const centers = compute_card_centers(rd.round, rd.matches.length, all_centers);
    all_centers.set(rd.round, centers);
  }

  // Total height from R1
  const r1_centers = all_centers.get(1) || [];
  const total_height = r1_centers.length > 0
    ? r1_centers[r1_centers.length - 1] + CARD_H + 20
    : CARD_H + 20;

  // Header offset for absolute positioning (label height)
  const HEADER_H = 28;

  return (
    <div className="flex items-start p-4 min-w-fit overflow-x-auto" style={{ minHeight: total_height + HEADER_H + 20 }}>
      {rounds_data.map((rd) => {
        const centers = all_centers.get(rd.round) || [];
        const is_final = rd.round === total_rounds;
        const is_last_pre_final = rd.round === total_rounds - 1;

        // Determine whether to show connector AFTER this round
        const next_rd = rounds_data.find(r => r.round === rd.round + 1);
        const next_centers = next_rd ? (all_centers.get(next_rd.round) || []) : [];
        // Skip connector after semifinal if 3rd place card goes in between
        const show_connector_after = !is_final && next_rd && next_centers.length > 0
          && !(is_last_pre_final && (has_third || has_bronze_panel));

        return (
          <React.Fragment key={rd.round}>
            {/* Joint bronze panel, in place of the 3rd-place match */}
            {is_final && has_bronze_panel && (
              <>
                {semifinal_round > 0 && (() => {
                  const semi_centers = all_centers.get(semifinal_round) || [];
                  const final_centers = all_centers.get(total_rounds) || [];
                  if (semi_centers.length > 0 && final_centers.length > 0) {
                    return (
                      <div className="shrink-0" style={{ width: LINE_W, paddingTop: HEADER_H, minHeight: total_height }}>
                        <ConnectorLines
                          prev_centers={semi_centers}
                          next_centers={final_centers}
                          height={total_height}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: CARD_W + 24, minHeight: total_height }}>
                  <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3 text-center">
                    3rd Place ×2
                  </div>
                  <div className="w-full rounded-2xl border-2 border-yellow-200 bg-yellow-50/60 p-3">
                    {bronze_ids.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-4">
                        Both beaten semi-finalists take bronze
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bronze_ids.map(id => {
                          const c = get_competitor(id);
                          return (
                            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-yellow-200">
                              <span className="text-sm">🥉</span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {get_name(id, get_competitor)}
                                </div>
                                {c?.club && <div className="text-[11px] text-gray-400 truncate">{c.club}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0" style={{ width: 16 }} />
              </>
            )}

            {/* Inject 3rd place BEFORE the final column */}
            {is_final && has_third && third_place && (
              <>
                {semifinal_round > 0 && (() => {
                  const semi_centers = all_centers.get(semifinal_round) || [];
                  const final_centers = all_centers.get(total_rounds) || [];
                  if (semi_centers.length > 0 && final_centers.length > 0) {
                    return (
                      <div className="shrink-0" style={{ width: LINE_W, paddingTop: HEADER_H, minHeight: total_height }}>
                        <ConnectorLines
                          prev_centers={semi_centers}
                          next_centers={final_centers}
                          height={total_height}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: CARD_W + 24, minHeight: total_height }}>
                  <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3 text-center">
                    3rd Place
                  </div>
                  <MatchCard match={third_place} get_competitor={get_competitor} on_start_match={on_start_match} {...card_props} />
                </div>

                <div className="shrink-0" style={{ width: 16 }} />
              </>
            )}

            {/* Round column */}
            <div className="shrink-0 relative" style={{ width: CARD_W, minHeight: total_height + HEADER_H }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
                {is_final ? 'Final' : `Round ${rd.round}`}
              </div>
              {rd.matches.map((match, mi) => (
                <div key={match.id} className="absolute" style={{ top: centers[mi] + HEADER_H, left: 0 }}>
                  <MatchCard match={match} get_competitor={get_competitor} on_start_match={on_start_match} {...card_props} />
                </div>
              ))}
            </div>

            {/* Connector lines to next round */}
            {show_connector_after && (
              <div className="shrink-0" style={{ width: LINE_W, paddingTop: HEADER_H, minHeight: total_height }}>
                <ConnectorLines
                  prev_centers={centers}
                  next_centers={next_centers}
                  height={total_height}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
