import { Competitor } from '../types/competitor';
import { TournamentCategory } from '../types/tournament';
import { SheetGrid } from './spreadsheet_reader';

/* ───────────────── column detection ───────────────── */

export type ImportField = 'first_name' | 'last_name' | 'club' | 'category';

/** Column index for each field, or null when it could not be found. */
export type ColumnMap = Record<ImportField, number | null>;

/**
 * Header spellings accepted for each field. Matching is done on the normalised
 * header (lower case, no spaces or punctuation), so "First Name", "first_name"
 * and "FIRSTNAME" all land on the same entry.
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  first_name: ['firstname', 'first', 'givenname', 'forename', 'name', 'vards'],
  last_name: ['lastname', 'last', 'surname', 'familyname', 'uzvards'],
  club: ['club', 'team', 'dojo', 'school', 'organisation', 'organization', 'klubs'],
  category: ['category', 'cat', 'division', 'class', 'weightclass', 'kategorija'],
};

const normalise_header = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Work out which column holds which field by looking at the header row.
 * A column is only claimed once, so a sheet with both "Name" and "Last Name"
 * maps "Name" to the first name rather than fighting over the same column.
 */
export function detect_columns(headers: string[]): ColumnMap {
  const map: ColumnMap = { first_name: null, last_name: null, club: null, category: null };
  const taken = new Set<number>();
  const normalised = headers.map(normalise_header);

  const claim = (field: ImportField, exact: boolean) => {
    if (map[field] !== null) return;
    for (let i = 0; i < normalised.length; i++) {
      if (taken.has(i) || !normalised[i]) continue;
      const hit = HEADER_ALIASES[field].some(alias =>
        exact ? normalised[i] === alias : normalised[i].includes(alias));
      if (hit) {
        map[field] = i;
        taken.add(i);
        return;
      }
    }
  };

  // Exact matches first so "club" never steals a column from "clubcategory".
  (['first_name', 'last_name', 'club', 'category'] as ImportField[]).forEach(f => claim(f, true));
  (['first_name', 'last_name', 'club', 'category'] as ImportField[]).forEach(f => claim(f, false));

  return map;
}

/* ───────────────── category matching ───────────────── */

/**
 * Normalise a category name for comparison: case, surrounding and repeated
 * whitespace, and the various dash characters that come out of Word and Excel
 * (en dash, em dash, non-breaking hyphen) are all levelled.
 */
export function normalise_category(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')   // dash variants → hyphen
    .replace(/\s*-\s*/g, '-')                  // "age - 6" → "age-6"
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CategoryMatch {
  category: TournamentCategory | null;
  /** True when it only matched after normalising — worth showing the operator. */
  fuzzy: boolean;
}

export function match_category(input: string, categories: TournamentCategory[]): CategoryMatch {
  const raw = input.trim();
  if (!raw) return { category: null, fuzzy: false };

  const exact = categories.find(c => c.name === raw);
  if (exact) return { category: exact, fuzzy: false };

  const target = normalise_category(raw);
  const loose = categories.find(c => normalise_category(c.name) === target);
  return loose ? { category: loose, fuzzy: true } : { category: null, fuzzy: false };
}

/* ───────────────── row building ───────────────── */

export type ImportStatus = 'ready' | 'duplicate' | 'blocked';

export interface ImportRow {
  /** 1-based row number as it appears in the spreadsheet, for the operator. */
  row_number: number;
  first_name: string;
  last_name: string;
  club: string;
  category_input: string;
  category_id: string | null;
  category_name: string;
  status: ImportStatus;
  message: string;
  /** Set when an existing competitor already covers this row. */
  existing_competitor_id: string | null;
}

export interface ImportSummary {
  total: number;
  ready: number;
  duplicate: number;
  blocked: number;
  /** Category names in the file that match nothing in this tournament. */
  unknown_categories: string[];
}

/** Identity used for duplicate detection: same person, same club. */
const identity_of = (first: string, last: string, club: string): string =>
  `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${club.trim().toLowerCase()}`;

export interface BuildRowsInput {
  grid: SheetGrid;
  columns: ColumnMap;
  categories: TournamentCategory[];
  /** Everyone already registered in the app. */
  competitors: Competitor[];
  /** Whether the header row should be skipped. */
  has_header: boolean;
}

/**
 * Turn a parsed sheet into reviewable rows. Nothing here writes anything — the
 * result describes exactly what an import would do so the operator can confirm
 * it first.
 *
 * A row is:
 *   - `blocked`   — a required field is missing, or the category is unknown
 *   - `duplicate` — this person already exists; they are only added to the
 *                   tournament, and their existing category is left alone
 *   - `ready`     — will be created and assigned to the category
 */
export function build_import_rows(input: BuildRowsInput): ImportRow[] {
  const { grid, columns, categories, competitors, has_header } = input;
  const rows: ImportRow[] = [];

  const existing_by_identity = new Map<string, Competitor>();
  for (const c of competitors) {
    existing_by_identity.set(identity_of(c.first_name, c.last_name, c.club), c);
  }
  /** Identities already seen in this file, to catch duplicates within it. */
  const seen_in_file = new Set<string>();

  const cell = (row: string[], index: number | null): string =>
    (index === null ? '' : (row[index] ?? '')).trim();

  const start = has_header ? 1 : 0;

  for (let i = start; i < grid.length; i++) {
    const raw = grid[i];
    const first_name = cell(raw, columns.first_name);
    const last_name = cell(raw, columns.last_name);
    const club = cell(raw, columns.club);
    const category_input = cell(raw, columns.category);

    // Skip rows that are entirely empty — trailing blanks are common.
    if (!first_name && !last_name && !club && !category_input) continue;

    const row_number = i + 1;
    const base = {
      row_number, first_name, last_name, club, category_input,
      category_id: null as string | null,
      category_name: '',
      existing_competitor_id: null as string | null,
    };

    const missing: string[] = [];
    if (!first_name) missing.push('first name');
    if (!last_name) missing.push('last name');
    if (!club) missing.push('club');
    if (missing.length > 0) {
      rows.push({ ...base, status: 'blocked', message: `Missing ${missing.join(', ')}` });
      continue;
    }

    if (!category_input) {
      rows.push({ ...base, status: 'blocked', message: 'Missing category' });
      continue;
    }

    const { category, fuzzy } = match_category(category_input, categories);
    if (!category) {
      rows.push({ ...base, status: 'blocked', message: `No category named "${category_input}"` });
      continue;
    }

    const identity = identity_of(first_name, last_name, club);
    const existing = existing_by_identity.get(identity);
    const repeated_in_file = seen_in_file.has(identity);
    seen_in_file.add(identity);

    if (existing || repeated_in_file) {
      rows.push({
        ...base,
        category_id: category.id,
        category_name: category.name,
        existing_competitor_id: existing ? existing.id : null,
        status: 'duplicate',
        message: repeated_in_file && !existing
          ? 'Repeated in this file — imported once'
          : 'Already registered — will be added to this tournament',
      });
      continue;
    }

    rows.push({
      ...base,
      category_id: category.id,
      category_name: category.name,
      status: 'ready',
      message: fuzzy ? `Matched "${category.name}"` : '',
    });
  }

  return rows;
}

export function summarise(rows: ImportRow[]): ImportSummary {
  const unknown = new Set<string>();
  for (const r of rows) {
    if (r.status === 'blocked' && r.category_input && !r.category_id) {
      // Only treat it as an unknown category when the rest of the row is usable.
      if (r.first_name && r.last_name && r.club) unknown.add(r.category_input.trim());
    }
  }
  return {
    total: rows.length,
    ready: rows.filter(r => r.status === 'ready').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length,
    blocked: rows.filter(r => r.status === 'blocked').length,
    unknown_categories: [...unknown],
  };
}

/* ───────────────── template ───────────────── */

const csv_escape = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * A starter file containing the expected headers, one example row, and the
 * exact category names of the tournament so they can be copied rather than
 * retyped. CSV so it opens in Excel, Numbers and Sheets alike.
 */
export function build_template_csv(categories: TournamentCategory[]): string {
  const lines = [
    ['First Name', 'Last Name', 'Club', 'Category'].join(','),
  ];
  const first = categories[0]?.name ?? '';
  lines.push(['Dima', 'Lasasimma', 'Dnagboy', first].map(csv_escape).join(','));
  lines.push('');
  lines.push(csv_escape('Categories in this tournament — copy one into the Category column:'));
  for (const c of categories) lines.push(csv_escape(c.name));
  return lines.join('\r\n');
}
