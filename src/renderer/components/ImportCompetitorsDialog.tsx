import React, { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Competitor } from '../../types/competitor';
import { Tournament, TournamentCategory } from '../../types/tournament';
import { read_spreadsheet, SheetGrid } from '../../services/spreadsheet_reader';
import {
  build_import_rows, build_template_csv, detect_columns, summarise,
  ColumnMap, ImportField, ImportRow,
} from '../../services/competitor_import_service';
import { useAppContext } from '../context/AppContext';

interface ImportCompetitorsDialogProps {
  tournament: Tournament;
  on_close: () => void;
}

const FIELD_LABELS: Record<ImportField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  club: 'Club',
  category: 'Category',
};

const STATUS_STYLES = {
  ready: 'bg-green-50 text-green-700',
  duplicate: 'bg-yellow-50 text-yellow-700',
  blocked: 'bg-kumite-red-50 text-kumite-red-700',
} as const;

/**
 * Spreadsheet import for competitors: pick a file, confirm how its columns map,
 * review exactly what will happen row by row, then commit. Nothing is written
 * until the operator confirms.
 */
export default function ImportCompetitorsDialog({ tournament, on_close }: ImportCompetitorsDialogProps) {
  const { competitors, import_competitors, update_tournament } = useAppContext();
  const file_input = useRef<HTMLInputElement>(null);

  const [file_name, set_file_name] = useState('');
  const [grid, set_grid] = useState<SheetGrid | null>(null);
  const [columns, set_columns] = useState<ColumnMap | null>(null);
  const [has_header, set_has_header] = useState(true);
  const [error, set_error] = useState('');
  const [result, set_result] = useState<{ created: number; added: number; skipped: number } | null>(null);

  const categories: TournamentCategory[] = tournament.categories || [];

  const headers = useMemo<string[]>(() => {
    if (!grid || grid.length === 0) return [];
    const width = Math.max(...grid.map(r => r.length));
    return Array.from({ length: width }, (_, i) =>
      has_header ? (grid[0][i] || `Column ${i + 1}`) : `Column ${i + 1}`);
  }, [grid, has_header]);

  const rows = useMemo<ImportRow[]>(() => {
    if (!grid || !columns) return [];
    return build_import_rows({ grid, columns, categories, competitors, has_header });
  }, [grid, columns, categories, competitors, has_header]);

  const summary = useMemo(() => summarise(rows), [rows]);

  const handle_file = useCallback(async (file: File) => {
    set_error('');
    set_result(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = read_spreadsheet(new Uint8Array(buffer));
      if (parsed.length === 0) {
        set_error('That file has no rows.');
        return;
      }
      set_file_name(file.name);
      set_grid(parsed);
      set_columns(detect_columns(parsed[0]));
      set_has_header(true);
    } catch (e) {
      set_error('Could not read that file. Save it as .xlsx or .csv and try again.');
    }
  }, []);

  const handle_download_template = useCallback(() => {
    const blob = new Blob([build_template_csv(categories)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tournament.name.replace(/[^\w\s-]/g, '')} - competitor template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [categories, tournament.name]);

  /** Add a category the file referenced but the tournament does not have. */
  const handle_create_category = useCallback((name: string) => {
    update_tournament({
      ...tournament,
      categories: [...categories, { id: uuid(), name: name.trim() }],
    });
  }, [tournament, categories, update_tournament]);

  const handle_import = useCallback(() => {
    const new_competitors: Competitor[] = rows
      .filter(r => r.status === 'ready')
      .map(r => ({
        id: uuid(),
        first_name: r.first_name,
        last_name: r.last_name,
        club: r.club,
        category_id: r.category_id,
      }));

    const existing_ids = rows
      .filter(r => r.status === 'duplicate' && r.existing_competitor_id)
      .map(r => r.existing_competitor_id as string);

    import_competitors(tournament.id, new_competitors, [...new Set(existing_ids)]);
    set_result({
      created: new_competitors.length,
      added: new Set(existing_ids).size,
      skipped: summary.blocked,
    });
  }, [rows, tournament.id, import_competitors, summary.blocked]);

  const reset = () => {
    set_grid(null); set_columns(null); set_file_name(''); set_error(''); set_result(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Import competitors</h2>
            <div className="text-sm text-gray-500 truncate">
              {file_name ? `${file_name} → ${tournament.name}` : tournament.name}
            </div>
          </div>
          <button onClick={on_close}
            className="w-9 h-9 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all text-lg font-bold shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* ── Result ── */}
          {result ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-lg font-bold text-gray-900 mb-1">Import complete</div>
              <div className="text-sm text-gray-500">
                {result.created} created · {result.added} already registered, added to this tournament
                {result.skipped > 0 && ` · ${result.skipped} left out`}
              </div>
              <div className="flex gap-2 justify-center mt-6">
                <button onClick={reset}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">
                  Import another file
                </button>
                <button onClick={on_close}
                  className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
                  Done
                </button>
              </div>
            </div>

          /* ── File picker ── */
          ) : !grid ? (
            <div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handle_file(f);
                }}
                onClick={() => file_input.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer
                           hover:border-gray-400 hover:bg-gray-50 transition-all"
              >
                <div className="text-4xl mb-3">📄</div>
                <div className="font-semibold text-gray-900">Drop a spreadsheet here, or click to choose</div>
                <div className="text-sm text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</div>
              </div>
              <input
                ref={file_input}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handle_file(f);
                  e.target.value = '';
                }}
              />

              <div className="mt-5 p-4 rounded-2xl bg-gray-50">
                <div className="text-sm font-semibold text-gray-900 mb-1">Expected columns</div>
                <div className="text-sm text-gray-500 mb-3">
                  First name, last name, club and category. Category must match one of this
                  tournament&apos;s categories.
                </div>
                <button onClick={handle_download_template}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:border-gray-400 transition-all">
                  ⬇ Download template
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-kumite-red-50 border border-kumite-red-200 text-kumite-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>

          /* ── Mapping + review ── */
          ) : (
            <div>
              {/* Column mapping */}
              <div className="mb-4 p-4 rounded-2xl bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-900">Columns</div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={has_header}
                      onChange={e => {
                        set_has_header(e.target.checked);
                        if (grid) set_columns(detect_columns(e.target.checked ? grid[0] : []));
                      }} />
                    First row is a header
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(FIELD_LABELS) as ImportField[]).map(field => (
                    <div key={field}>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        {FIELD_LABELS[field]}
                      </label>
                      <select
                        value={columns?.[field] ?? ''}
                        onChange={e => set_columns(prev => prev
                          ? { ...prev, [field]: e.target.value === '' ? null : Number(e.target.value) }
                          : prev)}
                        className={`w-full px-2 py-2 rounded-xl border text-sm bg-white outline-none transition-all
                          ${columns?.[field] === null
                            ? 'border-kumite-red-300 text-kumite-red-600'
                            : 'border-gray-200 focus:border-gray-900'}`}
                      >
                        <option value="">Not mapped</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">
                  {summary.ready} ready
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold">
                  {summary.duplicate} already registered
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-kumite-red-50 text-kumite-red-700 text-xs font-semibold">
                  {summary.blocked} blocked
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold">
                  {summary.total} rows
                </span>
              </div>

              {/* Missing categories */}
              {summary.unknown_categories.length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                  <div className="text-xs font-semibold text-yellow-800 mb-2">
                    These categories are not in {tournament.name}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary.unknown_categories.map(name => (
                      <button key={name} onClick={() => handle_create_category(name)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-yellow-300 text-yellow-800 text-xs font-semibold hover:bg-yellow-100 transition-all">
                        + Create &ldquo;{name}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rows */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left font-semibold px-3 py-2 w-12">#</th>
                      <th className="text-left font-semibold px-3 py-2">Name</th>
                      <th className="text-left font-semibold px-3 py-2 w-32">Club</th>
                      <th className="text-left font-semibold px-3 py-2 w-36">Category</th>
                      <th className="text-left font-semibold px-3 py-2 w-64">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.row_number} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-300">{row.row_number}</td>
                        <td className="px-3 py-2 truncate">
                          {`${row.first_name} ${row.last_name}`.trim() || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 truncate">{row.club || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 truncate">{row.category_input || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_STYLES[row.status]}`}>
                            {row.status === 'ready' ? 'Ready' : row.status === 'duplicate' ? 'Already registered' : 'Blocked'}
                          </span>
                          {row.message && (
                            <span className="text-[11px] text-gray-400 ml-2">{row.message}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {grid && !result && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
            <button onClick={reset}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">
              Choose another file
            </button>
            <div className="flex items-center gap-3">
              {summary.blocked > 0 && (
                <span className="text-xs text-gray-400">{summary.blocked} blocked rows are left out</span>
              )}
              <button
                onClick={handle_import}
                disabled={summary.ready + summary.duplicate === 0}
                className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm
                           hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg
                           disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Import {summary.ready + summary.duplicate} competitors
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
