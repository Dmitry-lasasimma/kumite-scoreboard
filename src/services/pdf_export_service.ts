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

  // Draw bracket
  const positive_matches = matches.filter(m => m.bracket_round > 0);
  const total_rounds = Math.max(...positive_matches.map(m => m.bracket_round), 0);
  const third_place = matches.find(m => m.bracket_round === -1);

  const start_y = 35;
  const available_h = page_h - start_y - 25;
  const col_width = (page_w - 28 - (third_place ? 60 : 0)) / Math.max(total_rounds, 1);
  const slot_h = 10;

  for (let round = 1; round <= total_rounds; round++) {
    const round_matches = positive_matches
      .filter(m => m.bracket_round === round)
      .sort((a, b) => a.match_number - b.match_number);

    const count = round_matches.length;
    const spacing = available_h / count;
    const x = 14 + (round - 1) * col_width;

    // Round header
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    const label = round === total_rounds ? 'FINAL' : `ROUND ${round}`;
    doc.text(label, x, start_y - 3);
    doc.setTextColor(0, 0, 0);

    round_matches.forEach((match, i) => {
      const center_y = start_y + i * spacing + spacing / 2;
      const y = center_y - slot_h;

      // Blue competitor box
      const is_blue_winner = match.winner_id === match.blue_competitor_id;
      if (is_blue_winner) {
        doc.setFillColor(37, 99, 235);
        doc.rect(x, y, col_width - 8, slot_h / 2, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(180, 180, 180);
        doc.rect(x, y, col_width - 8, slot_h / 2);
        doc.setTextColor(0, 0, 0);
      }
      doc.setFontSize(7);
      doc.setFont('helvetica', is_blue_winner ? 'bold' : 'normal');
      const blue_name = get_name(match.blue_competitor_id, competitors);
      const blue_club = get_club(match.blue_competitor_id, competitors);
      doc.text(blue_name, x + 2, y + 3.5);
      if (blue_club) {
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(is_blue_winner ? 220 : 150, is_blue_winner ? 220 : 150, is_blue_winner ? 255 : 150);
        doc.text(blue_club, x + 2, y + slot_h / 2 - 0.5);
      }

      // Red competitor box
      const red_y = y + slot_h / 2;
      const is_red_winner = match.winner_id === match.red_competitor_id;
      if (is_red_winner) {
        doc.setFillColor(220, 38, 38);
        doc.rect(x, red_y, col_width - 8, slot_h / 2, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(180, 180, 180);
        doc.rect(x, red_y, col_width - 8, slot_h / 2);
        doc.setTextColor(0, 0, 0);
      }
      doc.setFontSize(7);
      doc.setFont('helvetica', is_red_winner ? 'bold' : 'normal');
      const red_name = get_name(match.red_competitor_id, competitors);
      const red_club = get_club(match.red_competitor_id, competitors);
      doc.text(red_name, x + 2, red_y + 3.5);
      if (red_club) {
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(is_red_winner ? 255 : 150, is_red_winner ? 220 : 150, is_red_winner ? 220 : 150);
        doc.text(red_club, x + 2, red_y + slot_h / 2 - 0.5);
      }

      // Connector lines to next round
      doc.setDrawColor(180, 180, 180);
      doc.setTextColor(0, 0, 0);
      if (round < total_rounds) {
        const line_x = x + col_width - 8;
        const mid_y = center_y;
        doc.line(line_x, mid_y, line_x + 4, mid_y);
      }
    });
  }

  // 3rd place match
  if (third_place) {
    const x = page_w - 72;
    const y = page_h - 45;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 140, 0);
    doc.text('3RD PLACE', x, y - 3);
    doc.setTextColor(0, 0, 0);

    const is_blue_w = third_place.winner_id === third_place.blue_competitor_id;
    const is_red_w = third_place.winner_id === third_place.red_competitor_id;

    // Blue
    if (is_blue_w) { doc.setFillColor(37, 99, 235); doc.rect(x, y, 55, 5, 'F'); doc.setTextColor(255, 255, 255); }
    else { doc.setDrawColor(180, 180, 180); doc.rect(x, y, 55, 5); doc.setTextColor(0, 0, 0); }
    doc.setFontSize(7); doc.setFont('helvetica', is_blue_w ? 'bold' : 'normal');
    doc.text(get_name(third_place.blue_competitor_id, competitors), x + 2, y + 3.5);

    // Red
    if (is_red_w) { doc.setFillColor(220, 38, 38); doc.rect(x, y + 5, 55, 5, 'F'); doc.setTextColor(255, 255, 255); }
    else { doc.setDrawColor(180, 180, 180); doc.rect(x, y + 5, 55, 5); doc.setTextColor(0, 0, 0); }
    doc.setFontSize(7); doc.setFont('helvetica', is_red_w ? 'bold' : 'normal');
    doc.text(get_name(third_place.red_competitor_id, competitors), x + 2, y + 8.5);
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
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

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
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
    doc.text('Final Standings', 14, y);
    y += 8;

    placements.forEach(p => {
      const name = get_name(p.competitor_id, competitors);
      const club = get_club(p.competitor_id, competitors);

      doc.setFillColor(p.color[0], p.color[1], p.color[2]);
      doc.roundedRect(14, y, page_w - 28, 12, 2, 2, 'F');

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(p.place, 18, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(name, 50, y + 5);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(club, 50, y + 10);

      y += 15;
    });
  }

  // Match Results Table
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Match Results', 14, y);
  y += 8;

  // Table header
  doc.setFillColor(40, 40, 40);
  doc.rect(14, y, page_w - 28, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Match', 18, y + 5);
  doc.text('Blue (AO)', 45, y + 5);
  doc.text('Red (AKA)', 110, y + 5);
  doc.text('Winner', page_w - 40, y + 5);
  y += 7;

  const all_matches = [...positive_matches.sort((a, b) => a.bracket_round - b.bracket_round || a.match_number - b.match_number)];
  if (third_place_match) all_matches.push(third_place_match);

  all_matches.forEach((match, i) => {
    if (match.blue_competitor_id === 'TBD' && match.red_competitor_id === 'TBD') return;

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y, page_w - 28, 7, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const label = match.bracket_round === -1 ? '3rd Place' : `R${match.bracket_round} M${match.match_number}`;
    doc.text(label, 18, y + 4.5);

    const blue_name = get_name(match.blue_competitor_id, competitors);
    const red_name = get_name(match.red_competitor_id, competitors);
    const winner_name = match.winner_id ? get_name(match.winner_id, competitors) : '-';

    const is_blue_w = match.winner_id === match.blue_competitor_id;
    const is_red_w = match.winner_id === match.red_competitor_id;

    doc.setFont('helvetica', is_blue_w ? 'bold' : 'normal');
    if (is_blue_w) doc.setTextColor(37, 99, 235);
    doc.text(blue_name, 45, y + 4.5);

    doc.setTextColor(0, 0, 0);
    doc.text('vs', 100, y + 4.5);

    doc.setFont('helvetica', is_red_w ? 'bold' : 'normal');
    if (is_red_w) doc.setTextColor(220, 38, 38);
    doc.text(red_name, 110, y + 4.5);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(winner_name, page_w - 40, y + 4.5);

    y += 7;
  });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const ph = doc.internal.pageSize.getHeight();
  doc.text('Generated by Kumite Scoreboard', 14, ph - 5);

  const filename = `${tournament.name}${category_name ? '_' + category_name : ''}_results.pdf`.replace(/\s+/g, '_');
  doc.save(filename);
}
