import React from 'react';
import { Match } from '../../types/match';
import { Competitor } from '../../types/competitor';

interface BracketDisplayProps {
  matches: Match[];
  competitors: Competitor[];
  total_rounds: number;
  on_start_match: (match: Match) => void;
  get_competitor: (id: string) => Competitor | undefined;
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

function MatchCard({ match, get_competitor, on_start_match }: {
  match: Match;
  get_competitor: (id: string) => Competitor | undefined;
  on_start_match: (match: Match) => void;
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
        ${can_start ? 'hover:shadow-xl cursor-pointer' : ''}
        ${is_waiting ? 'opacity-40' : ''}`}
      style={{ width: CARD_W, minHeight: CARD_H }}
      onClick={() => can_start && on_start_match(match)}
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
          {is_bye_win ? 'BYE' : is_done ? 'Completed' : is_active ? 'In Progress' : can_start ? 'Click to Start' : 'Waiting'}
        </span>
      </div>

      <div className={`flex items-center px-3 py-2 gap-2 border-l-4 border-kumite-blue-500
        ${match.winner_id === match.blue_competitor_id ? 'bg-kumite-blue-50' : 'bg-white'}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-kumite-blue-500" />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${match.blue_competitor_id === 'TBD' ? 'text-gray-300' : 'text-gray-900'}`}>
            {get_name(match.blue_competitor_id, get_competitor)}
          </div>
          <div className="text-[10px] text-gray-400 truncate">
            {get_club(match.blue_competitor_id, get_competitor)}
          </div>
        </div>
        {is_done && typeof match.blue_score === 'number' && (
          <span className="text-sm font-score font-bold text-kumite-blue-700 tabular-nums">{match.blue_score}</span>
        )}
        {match.winner_id === match.blue_competitor_id && (
          <span className="text-xs font-bold text-kumite-blue-600 bg-kumite-blue-100 px-2 py-0.5 rounded">WIN</span>
        )}
      </div>

      <div className="h-px bg-gray-100" />

      <div className={`flex items-center px-3 py-2 gap-2 border-l-4 border-kumite-red-500
        ${match.winner_id === match.red_competitor_id ? 'bg-kumite-red-50' : 'bg-white'}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-kumite-red-500" />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${match.red_competitor_id === 'TBD' ? 'text-gray-300' : 'text-gray-900'}`}>
            {get_name(match.red_competitor_id, get_competitor)}
          </div>
          <div className="text-[10px] text-gray-400 truncate">
            {get_club(match.red_competitor_id, get_competitor)}
          </div>
        </div>
        {is_done && typeof match.red_score === 'number' && (
          <span className="text-sm font-score font-bold text-kumite-red-700 tabular-nums">{match.red_score}</span>
        )}
        {match.winner_id === match.red_competitor_id && (
          <span className="text-xs font-bold text-kumite-red-600 bg-kumite-red-100 px-2 py-0.5 rounded">WIN</span>
        )}
      </div>
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

export default function BracketDisplay({ matches, competitors, total_rounds, on_start_match, get_competitor }: BracketDisplayProps) {
  const third_place = matches.find(m => m.bracket_round === -1);
  const has_third = !!third_place;
  const semifinal_round = total_rounds > 1 ? total_rounds - 1 : 0;

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
      {rounds_data.map((rd, ri) => {
        const centers = all_centers.get(rd.round) || [];
        const is_final = rd.round === total_rounds;
        const is_semifinal = rd.round === semifinal_round && semifinal_round > 0;
        const is_last_pre_final = rd.round === total_rounds - 1;

        // Determine whether to show connector AFTER this round
        const next_rd = rounds_data.find(r => r.round === rd.round + 1);
        const next_centers = next_rd ? (all_centers.get(next_rd.round) || []) : [];
        // Skip connector after semifinal if 3rd place card goes in between
        const show_connector_after = !is_final && next_rd && next_centers.length > 0 && !(is_last_pre_final && has_third);

        return (
          <React.Fragment key={rd.round}>
            {/* Inject 3rd place BEFORE the final column */}
            {is_final && has_third && third_place && (
              <>
                {/* Connector lines from semifinal to final (drawn before 3rd place visually but structurally spans) */}
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
                  <MatchCard
                    match={third_place}
                    get_competitor={get_competitor}
                    on_start_match={on_start_match}
                  />
                </div>

                {/* Small spacer */}
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
                  <MatchCard
                    match={match}
                    get_competitor={get_competitor}
                    on_start_match={on_start_match}
                  />
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
