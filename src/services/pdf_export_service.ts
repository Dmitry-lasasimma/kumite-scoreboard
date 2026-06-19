import { jsPDF } from 'jspdf';
import { Tournament } from '../types/tournament';
import { Match } from '../types/match';
import { Competitor } from '../types/competitor';

function get_name(id: string, competitors: Competitor[]): string {
  if (id === 'BYE') return 'BYE';
  if (id === 'TBD') return 'TBD';
  const c = competitors.find(comp => comp.id === id);
  return c ? `${c.first_name} ${c.last_name}` : '';
}

function get_club(id: string, competitors: Competitor[]): string {
  if (id === 'BYE' || id === 'TBD') return '';
  const c = competitors.find(comp => comp.id === id);
  return c ? c.club : '';
}

/**
 * Truncate `text` with an ellipsis so it fits within `max_w` mm at the doc's
 * current font size. Prevents text from overlapping neighbouring columns.
 */
function fit_text(doc: jsPDF, text: string, max_w: number): string {
  if (!text) return '';
  if (doc.getTextWidth(text) <= max_w) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '...') > max_w) {
    t = t.slice(0, -1);
  }
  return t.trimEnd() + '...';
}

export function export_bracket_pdf(
  tournament: Tournament,
  matches: Match[],
  competitors: Competitor[],
  category_name?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const page_w = doc.internal.pageSize.getWidth();
  const page_h = doc.internal.pageSize.getHeight();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(tournament.name, 14, 15);

  if (category_name) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${category_name}`, 14, 22);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pairing: ${tournament.pairing_constraint.replace('_', ' ')}`, 14, category_name ? 28 : 22);
  doc.text(new Date().toLocaleDateString(), page_w - 40, 15);

  // Layout geometry
  const positive_matches = matches.filter(m => m.bracket_round > 0);
  const total_rounds = Math.max(...positive_matches.map(m => m.bracket_round), 0);
  const third_place = matches.find(m => m.bracket_round === -1);

  const left_margin = 14;
  const start_y = 35;
  const available_h = page_h - start_y - 25;
  const reserved_third = third_place ? 64 : 0;
  const col_width = (page_w - left_margin * 2 - reserved_third) / Math.max(total_rounds, 1);
  const box_w = col_width - 10;           // leave a 10mm gap for connector lines
  const connector_gap = col_width - box_w; // horizontal room between columns
  const slot_h = 11;                       // total height of a match box (two rows)
  const row_h = slot_h / 2;

  // Pre-compute the vertical centre of every match, per round.
  const centers: Record<number, number[]> = {};
  for (let round = 1; round <= total_rounds; round++) {
    const count = positive_matches.filter(m => m.bracket_round === round).length || 1;
    const spacing = available_h / count;
    centers[round] = Array.from({ length: count }, (_, i) => start_y + i * spacing + spacing / 2);
  }

  /** Draw one competitor row inside a match box. */
  function draw_competitor_row(
    x: number, y: number, w: number, is_winner: boolean,
    is_blue: boolean, comp_id: string,
  ) {
    if (is_winner) {
      if (is_blue) doc.setFillColor(37, 99, 235);
      else doc.setFillColor(220, 38, 38);
      doc.rect(x, y, w, row_h, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(190, 190, 190);
      doc.rect(x, y, w, row_h);
      doc.setTextColor(30, 30, 30);
    }

    const name = get_name(comp_id, competitors);
    const club = get_club(comp_id, competitors);

    doc.setFontSize(7);
    doc.setFont('helvetica', is_winner ? 'bold' : 'normal');
    // Reserve room for the club (right side) so name + club never collide.
    const name_max = club ? w - 4 - 22 : w - 4;
    doc.text(fit_text(doc, name, name_max), x + 2, y + row_h / 2 + 1.2);

    if (club) {
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      if (is_winner) doc.setTextColor(225, 225, 255);
      else doc.setTextColor(150, 150, 150);
      const club_text = fit_text(doc, club, 20);
      doc.text(club_text, x + w - 2, y + row_h / 2 + 1, { align: 'right' });
    }
  }

  for (let round = 1; round <= total_rounds; round++) {
    const round_matches = positive_matches
      .filter(m => m.bracket_round === round)
      .sort((a, b) => a.match_number - b.match_number);

    const x = left_margin + (round - 1) * col_width;

    // Round header
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    const label = round === total_rounds ? 'FINAL' : `ROUND ${round}`;
    doc.text(label, x, start_y - 3);
    doc.setTextColor(0, 0, 0);

    round_matches.forEach((match, i) => {
      const center_y = centers[round][i];
      const y = center_y - row_h; // top of the two-row box

      draw_competitor_row(x, y, box_w, match.winner_id === match.blue_competitor_id, true, match.blue_competitor_id);
      draw_competitor_row(x, y + row_h, box_w, match.winner_id === match.red_competitor_id, false, match.red_competitor_id);

      // Score chips for completed matches
      if (match.status === 'completed' && typeof match.blue_score === 'number' && typeof match.red_score === 'number') {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(90, 90, 90);
        doc.text(`${match.blue_score}-${match.red_score}`, x + box_w - 1, y - 0.8, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
    });

    // Connector lines into the next round (proper bracket tree).
    if (round < total_rounds) {
      doc.setDrawColor(170, 170, 170);
      const next_centers = centers[round + 1] || [];
      const mid_x = x + box_w + connector_gap / 2;
      next_centers.forEach((target_y, j) => {
        const top_src = centers[round][j * 2];
        const bot_src = centers[round][j * 2 + 1];
        if (top_src == null) return;
        // horizontal out of top source
        doc.line(x + box_w, top_src, mid_x, top_src);
        if (bot_src != null) {
          // horizontal out of bottom source + vertical join
          doc.line(x + box_w, bot_src, mid_x, bot_src);
          doc.line(mid_x, top_src, mid_x, bot_src);
        }
        // horizontal into the next-round box
        doc.line(mid_x, target_y, x + col_width, target_y);
      });
    }
  }

  // 3rd place match (bottom-right corner)
  if (third_place) {
    const x = page_w - reserved_third - 2;
    const tp_box_w = reserved_third - 6;
    const y = page_h - 40;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 140, 0);
    doc.text('3RD PLACE', x, y - 3);
    doc.setTextColor(0, 0, 0);

    draw_competitor_row(x, y, tp_box_w, third_place.winner_id === third_place.blue_competitor_id, true, third_place.blue_competitor_id);
    draw_competitor_row(x, y + row_h, tp_box_w, third_place.winner_id === third_place.red_competitor_id, false, third_place.red_competitor_id);
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by Kumite Scoreboard', 14, page_h - 5);

  const filename = `${tournament.name}${category_name ? '_' + category_name : ''}_bracket.pdf`.replace(/\s+/g, '_');
  doc.save(filename);
}

export function export_results_pdf(
  tournament: Tournament,
  matches: Match[],
  competitors: Competitor[],
  category_name?: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const page_w = doc.internal.pageSize.getWidth();
  const margin = 14;
  const content_w = page_w - margin * 2;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(tournament.name, page_w / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (category_name) {
    doc.text(`Category: ${category_name}`, page_w / 2, 28, { align: 'center' });
  }
  doc.setFontSize(9);
  doc.text(`Results - ${new Date().toLocaleDateString()}`, page_w / 2, category_name ? 35 : 28, { align: 'center' });

  let y = category_name ? 45 : 38;

  // Determine placements
  const positive_matches = matches.filter(m => m.bracket_round > 0);
  const total_rounds = Math.max(...positive_matches.map(m => m.bracket_round), 0);
  const final_match = positive_matches.find(m => m.bracket_round === total_rounds);
  const third_place_match = matches.find(m => m.bracket_round === -1);

  const placements: { place: string; competitor_id: string; color: [number, number, number] }[] = [];

  if (final_match?.winner_id) {
    placements.push({ place: '1st Place', competitor_id: final_match.winner_id, color: [255, 215, 0] });
    const runner_up = final_match.blue_competitor_id === final_match.winner_id
      ? final_match.red_competitor_id : final_match.blue_competitor_id;
    placements.push({ place: '2nd Place', competitor_id: runner_up, color: [192, 192, 192] });
  }

  if (third_place_match?.winner_id) {
    placements.push({ place: '3rd Place', competitor_id: third_place_match.winner_id, color: [205, 127, 50] });
    const fourth = third_place_match.blue_competitor_id === third_place_match.winner_id
      ? third_place_match.red_competitor_id : third_place_match.blue_competitor_id;
    if (fourth && fourth !== 'TBD') {
      placements.push({ place: '4th Place', competitor_id: fourth, color: [180, 180, 180] });
    }
  }

  // Podium
  if (placements.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Final Standings', margin, y);
    y += 8;

    placements.forEach(p => {
      doc.setFillColor(p.color[0], p.color[1], p.color[2]);
      doc.roundedRect(margin, y, content_w, 12, 2, 2, 'F');

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(p.place, margin + 4, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const name = fit_text(doc, get_name(p.competitor_id, competitors), content_w - 50);
      doc.text(name, margin + 36, y + 5);

      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      const club = fit_text(doc, get_club(p.competitor_id, competitors), content_w - 50);
      doc.text(club, margin + 36, y + 10);

      y += 15;
    });
  }

  // Match Results Table
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Match Results', margin, y);
  y += 8;

  // Column x-positions (mm). Portrait A4 content spans 14..196.
  const COL = {
    match: margin + 2,    // 16
    blue: 38,
    vs: 92,
    red: 100,
    score: 150,
    winner: 170,
  };
  const BLUE_MAX = COL.vs - COL.blue - 2;     // ~52
  const RED_MAX = COL.score - COL.red - 2;     // ~48
  const WINNER_MAX = page_w - margin - COL.winner; // ~26

  // Table header
  doc.setFillColor(40, 40, 40);
  doc.rect(margin, y, content_w, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Match', COL.match, y + 5);
  doc.text('Blue (AO)', COL.blue, y + 5);
  doc.text('Red (AKA)', COL.red, y + 5);
  doc.text('Score', COL.score, y + 5);
  doc.text('Winner', COL.winner, y + 5);
  y += 7;

  const all_matches = [...positive_matches.sort((a, b) => a.bracket_round - b.bracket_round || a.match_number - b.match_number)];
  if (third_place_match) all_matches.push(third_place_match);

  let row_index = 0;
  all_matches.forEach((match) => {
    if (match.blue_competitor_id === 'TBD' && match.red_competitor_id === 'TBD') return;

    if (row_index % 2 === 0) {
      doc.setFillColor(247, 247, 247);
      doc.rect(margin, y, content_w, 7, 'F');
    }
    row_index++;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const label = match.bracket_round === -1 ? '3rd Place' : `R${match.bracket_round} M${match.match_number}`;
    doc.text(label, COL.match, y + 4.5);

    const is_blue_w = match.winner_id === match.blue_competitor_id;
    const is_red_w = match.winner_id === match.red_competitor_id;

    doc.setFont('helvetica', is_blue_w ? 'bold' : 'normal');
    doc.setTextColor(is_blue_w ? 37 : 0, is_blue_w ? 99 : 0, is_blue_w ? 235 : 0);
    doc.text(fit_text(doc, get_name(match.blue_competitor_id, competitors), BLUE_MAX), COL.blue, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('vs', COL.vs, y + 4.5);

    doc.setFont('helvetica', is_red_w ? 'bold' : 'normal');
    doc.setTextColor(is_red_w ? 220 : 0, is_red_w ? 38 : 0, is_red_w ? 38 : 0);
    doc.text(fit_text(doc, get_name(match.red_competitor_id, competitors), RED_MAX), COL.red, y + 4.5);

    // Score
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const score_text = (typeof match.blue_score === 'number' && typeof match.red_score === 'number')
      ? `${match.blue_score} - ${match.red_score}` : '-';
    doc.text(score_text, COL.score, y + 4.5);

    // Winner
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const winner_name = match.winner_id ? get_name(match.winner_id, competitors) : '-';
    doc.text(fit_text(doc, winner_name, WINNER_MAX), COL.winner, y + 4.5);

    y += 7;
  });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const ph = doc.internal.pageSize.getHeight();
  doc.text('Generated by Kumite Scoreboard', margin, ph - 5);

  const filename = `${tournament.name}${category_name ? '_' + category_name : ''}_results.pdf`.replace(/\s+/g, '_');
  doc.save(filename);
}
