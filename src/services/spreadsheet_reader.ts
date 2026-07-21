import { unzipSync, strFromU8 } from 'fflate';

/**
 * Minimal, read-only spreadsheet reader for competitor imports.
 *
 * An .xlsx file is a zip of XML parts, and an import only needs the text of the
 * first sheet, so this pulls out exactly that rather than pulling in a full
 * spreadsheet library. Formulas, styling, dates and multi-sheet workbooks are
 * deliberately not interpreted — every cell is read as the text it displays.
 */

/** A sheet as a grid of trimmed strings. Ragged rows are padded by the caller. */
export type SheetGrid = string[][];

/* ───────────────── XML helpers ───────────────── */

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

function decode_xml(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, m => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Concatenated text of every <t> element inside a fragment. */
function extract_text(fragment: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) out += m[1] ?? '';
  return decode_xml(out);
}

/**
 * Convert an A1-style reference to a zero-based column index.
 * "A" → 0, "Z" → 25, "AA" → 26.
 */
export function column_index_from_ref(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref.toUpperCase());
  if (!letters) return 0;
  let index = 0;
  for (const ch of letters[1]) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/* ───────────────── xlsx ───────────────── */

/** Shared strings table: cells of type "s" hold an index into this. */
function read_shared_strings(files: Record<string, Uint8Array>): string[] {
  const entry = files['xl/sharedStrings.xml'];
  if (!entry) return [];
  const xml = strFromU8(entry);
  const items: string[] = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) items.push(extract_text(m[1]));
  return items;
}

/**
 * Path of the first worksheet. Falls back to the conventional path when the
 * workbook relationships cannot be read.
 */
function find_first_sheet_path(files: Record<string, Uint8Array>): string | null {
  const direct = Object.keys(files)
    .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(/(\d+)/.exec(a)![1]);
      const nb = Number(/(\d+)/.exec(b)![1]);
      return na - nb;
    });
  return direct[0] ?? null;
}

function read_worksheet(xml: string, shared: string[]): SheetGrid {
  const grid: SheetGrid = [];
  const row_re = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>|<row[^>]*\/>/g;
  let row_match: RegExpExecArray | null;

  while ((row_match = row_re.exec(xml)) !== null) {
    const body = row_match[1] ?? '';
    const cells: string[] = [];

    const cell_re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cell_match: RegExpExecArray | null;
    while ((cell_match = cell_re.exec(body)) !== null) {
      const attrs = cell_match[1] || '';
      const content = cell_match[2] ?? '';

      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const col = ref ? column_index_from_ref(ref) : cells.length;

      let value = '';
      if (type === 's') {
        const idx = Number(extract_v(content));
        value = Number.isFinite(idx) ? (shared[idx] ?? '') : '';
      } else if (type === 'inlineStr') {
        value = extract_text(content);
      } else if (type === 'str') {
        value = decode_xml(extract_v(content));
      } else {
        value = decode_xml(extract_v(content));
      }

      while (cells.length < col) cells.push('');
      cells[col] = value.trim();
    }

    grid.push(cells);
  }

  return grid;
}

function extract_v(content: string): string {
  const m = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(content);
  return m ? m[1] : '';
}

/** Read the first worksheet of an .xlsx file. */
export function read_xlsx(data: Uint8Array): SheetGrid {
  const files = unzipSync(data);
  const sheet_path = find_first_sheet_path(files);
  if (!sheet_path) throw new Error('No worksheet found in this file.');
  const shared = read_shared_strings(files);
  return read_worksheet(strFromU8(files[sheet_path]), shared);
}

/* ───────────────── csv ───────────────── */

/**
 * Parse delimited text, honouring quoted fields, escaped quotes and newlines
 * inside quotes. The delimiter is detected from the first line.
 */
export function read_csv(text: string): SheetGrid {
  const clean = text.replace(/^﻿/, '');       // strip BOM
  const first_line = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (first_line.split(';').length > first_line.split(',').length) ? ';' : ',';

  const grid: SheetGrid = [];
  let row: string[] = [];
  let field = '';
  let in_quotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (in_quotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else in_quotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') { in_quotes = true; continue; }
    if (ch === delimiter) { row.push(field.trim()); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field.trim()); grid.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    grid.push(row);
  }

  return grid;
}

/* ───────────────── entry point ───────────────── */

/** True when the bytes begin with the local file header of a zip archive. */
function is_zip(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0x50 && data[1] === 0x4b;
}

/**
 * Read a competitor file. The format is decided by content rather than by
 * extension, so a .csv saved with an .xlsx name (or the reverse) still works.
 */
export function read_spreadsheet(data: Uint8Array): SheetGrid {
  if (is_zip(data)) return read_xlsx(data);
  return read_csv(strFromU8(data));
}
