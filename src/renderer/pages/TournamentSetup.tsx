import React, { useState, useCallback } from 'react';
import { Tournament, TournamentCategory, ThirdPlaceMode, DEFAULT_THIRD_PLACE_MODE } from '../../types/tournament';
import { useAppContext } from '../context/AppContext';
import { MATCH_DURATIONS, DEFAULT_DURATION } from '../../utils/constants';
import { format_time } from '../../utils/validators';
import { v4 as uuid } from 'uuid';

const THIRD_PLACE_OPTIONS: { value: ThirdPlaceMode; label: string; desc: string }[] = [
  { value: 'playoff', label: '1 Third Place', desc: 'Beaten semi-finalists play a 3rd-place match — one bronze, one 4th' },
  { value: 'dual', label: '2 Third Places', desc: 'Both beaten semi-finalists take bronze — no 3rd-place match' },
];

export default function TournamentSetup() {
  const { tournaments, add_tournament, update_tournament, delete_tournament, set_page, tournament_competitors } = useAppContext();
  const [name, set_name] = useState('');
  const [duration, set_duration] = useState<number>(DEFAULT_DURATION);
  const [third_place_mode, set_third_place_mode] = useState<ThirdPlaceMode>(DEFAULT_THIRD_PLACE_MODE);
  const [categories, set_categories] = useState<TournamentCategory[]>([]);
  const [category_input, set_category_input] = useState('');

  // Editing categories on existing tournament
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [edit_cat_input, set_edit_cat_input] = useState('');

  const handle_add_category = useCallback(() => {
    const trimmed = category_input.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    set_categories(prev => [...prev, { id: uuid(), name: trimmed }]);
    set_category_input('');
  }, [category_input, categories]);

  const handle_remove_category = useCallback((id: string) => {
    set_categories(prev => prev.filter(c => c.id !== id));
  }, []);

  // A tournament is drawn per category, so it cannot exist without at least one.
  const can_create = name.trim().length > 0 && categories.length > 0;

  const handle_create = useCallback(() => {
    if (!name.trim() || categories.length === 0) return;
    const tournament: Tournament = {
      id: uuid(),
      name: name.trim(),
      categories,
      default_duration: duration,
      third_place_mode,
      status: 'pending',
    };
    add_tournament(tournament);
    set_name('');
    set_duration(DEFAULT_DURATION);
    set_third_place_mode(DEFAULT_THIRD_PLACE_MODE);
    set_categories([]);
  }, [name, duration, third_place_mode, categories, add_tournament]);

  /** Add a category to an existing tournament */
  const handle_add_edit_category = useCallback((tid: string) => {
    const trimmed = edit_cat_input.trim();
    if (!trimmed) return;
    const t = tournaments.find(x => x.id === tid);
    if (!t) return;
    if (t.categories?.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const new_cat: TournamentCategory = { id: uuid(), name: trimmed };
    update_tournament({ ...t, categories: [...(t.categories || []), new_cat] });
    set_edit_cat_input('');
  }, [edit_cat_input, tournaments, update_tournament]);

  /**
   * Remove a category from an existing tournament. The last one cannot be
   * removed — a tournament with no category has nothing to draw.
   */
  const handle_remove_edit_category = useCallback((tid: string, cat_id: string) => {
    const t = tournaments.find(x => x.id === tid);
    if (!t) return;
    const remaining = (t.categories || []).filter(c => c.id !== cat_id);
    if (remaining.length === 0) return;
    update_tournament({ ...t, categories: remaining });
  }, [tournaments, update_tournament]);

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* Create Form */}
      <div className="w-96 shrink-0">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Create Tournament</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tournament Name</label>
              <input
                value={name}
                onChange={e => set_name(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle_create()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm"
                placeholder="e.g. Regional Championship 2026"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Match Time</label>
              <div className="flex gap-2">
                {MATCH_DURATIONS.map(d => (
                  <button
                    key={d.seconds}
                    onClick={() => set_duration(d.seconds)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold font-score transition-all border-2
                      ${duration === d.seconds
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1.5">
                Every match in this tournament starts at this time automatically.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Third Place</label>
              <div className="space-y-2">
                {THIRD_PLACE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set_third_place_mode(opt.value)}
                    className={`w-full p-3 rounded-xl text-left transition-all border-2
                      ${third_place_mode === opt.value
                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className="font-semibold text-sm text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Categories <span className="text-kumite-red-500">*</span>
              </label>
              <div className="text-xs text-gray-400 mb-2">
                Competitors are drawn against others in the same category. At least one is required.
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  value={category_input}
                  onChange={e => set_category_input(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handle_add_category())}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm"
                  placeholder="e.g. Kumite Male -67kg"
                />
                <button
                  onClick={handle_add_category}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all"
                >
                  Add
                </button>
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <span key={cat.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">
                      {cat.name}
                      <button onClick={() => handle_remove_category(cat.id)}
                        className="text-gray-400 hover:text-kumite-red-500 transition-colors text-sm leading-none">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handle_create}
            disabled={!can_create}
            className="w-full mt-6 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm
                       hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Create Tournament
          </button>
          {!can_create && (
            <div className="text-xs text-gray-400 text-center mt-2">
              {!name.trim() ? 'Enter a tournament name' : 'Add at least one category'}
            </div>
          )}
        </div>
      </div>

      {/* Tournament List */}
      <div className="flex-1 flex flex-col min-w-0">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Tournaments <span className="text-gray-400 font-normal text-base ml-1">({tournaments.length})</span>
        </h2>

        <div className="flex-1 overflow-auto">
          {tournaments.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🏆</div>
              <div className="font-semibold">No tournaments yet</div>
              <div className="text-sm mt-1">Create a tournament to get started</div>
            </div>
          ) : (
            <div className="grid gap-3">
              {tournaments.map(t => {
                const comp_count = (tournament_competitors[t.id] || []).length;
                const is_editing = editing_id === t.id;

                return (
                  <div key={t.id} className="card px-5 py-4 group hover:shadow-lg transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{t.name}</div>
                        <div className="flex gap-2 mt-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold font-score">
                            ⏱ {format_time(t.default_duration ?? DEFAULT_DURATION)}
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold
                            ${t.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                              t.status === 'in_progress' ? 'bg-green-50 text-green-700' :
                              'bg-gray-100 text-gray-600'}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-kumite-blue-50 text-kumite-blue-700 text-xs font-semibold">
                            {comp_count} competitors
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold">
                            {(t.third_place_mode ?? DEFAULT_THIRD_PLACE_MODE) === 'dual' ? '2 bronze' : '1 bronze'}
                          </span>
                          {t.categories && t.categories.length > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold">
                              {t.categories.length} categories
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => set_editing_id(is_editing ? null : t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            is_editing
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                          }`}
                        >
                          {is_editing ? 'Done' : 'Edit'}
                        </button>
                        <button
                          onClick={() => set_page('competitors')}
                          className="px-3 py-1.5 rounded-lg bg-kumite-blue-50 text-kumite-blue-600 text-xs font-semibold hover:bg-kumite-blue-100 transition-all"
                        >
                          Add Competitors
                        </button>
                        <button
                          onClick={() => delete_tournament(t.id)}
                          className="px-3 py-1.5 rounded-lg bg-kumite-red-50 text-kumite-red-600 text-xs font-semibold hover:bg-kumite-red-100 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Category tags (always visible if categories exist) */}
                    {t.categories && t.categories.length > 0 && !is_editing && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.categories.map(cat => (
                          <span key={cat.id} className="px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium">{cat.name}</span>
                        ))}
                      </div>
                    )}

                    {/* Edit panel */}
                    {is_editing && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">
                          Match Time
                        </label>
                        <div className="flex gap-2 mb-4">
                          {MATCH_DURATIONS.map(d => {
                            const current = (t.default_duration ?? DEFAULT_DURATION) === d.seconds;
                            return (
                              <button
                                key={d.seconds}
                                onClick={() => update_tournament({ ...t, default_duration: d.seconds })}
                                className={`flex-1 py-2 rounded-xl text-sm font-semibold font-score transition-all border-2
                                  ${current
                                    ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                                    : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>

                        <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">
                          Third Place
                        </label>
                        <div className="flex gap-2 mb-1.5">
                          {THIRD_PLACE_OPTIONS.map(opt => {
                            const current = (t.third_place_mode ?? DEFAULT_THIRD_PLACE_MODE) === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => update_tournament({ ...t, third_place_mode: opt.value })}
                                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border-2
                                  ${current
                                    ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                                    : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-400 mb-4">
                          Changing this only affects brackets generated from now on. Re-generate an
                          existing bracket to apply it.
                        </div>

                        <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">
                          Manage Categories
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={edit_cat_input}
                            onChange={e => set_edit_cat_input(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handle_add_edit_category(t.id))}
                            className="flex-1 px-3 py-2 rounded-xl border border-purple-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                            placeholder="New category name"
                            autoFocus
                          />
                          <button
                            onClick={() => handle_add_edit_category(t.id)}
                            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all"
                          >
                            Add
                          </button>
                        </div>
                        {t.categories && t.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {t.categories.map(cat => {
                              const is_last = (t.categories || []).length === 1;
                              return (
                                <span key={cat.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">
                                  {cat.name}
                                  <button
                                    onClick={() => handle_remove_edit_category(t.id, cat.id)}
                                    disabled={is_last}
                                    title={is_last ? 'A tournament needs at least one category' : 'Remove category'}
                                    className="text-purple-400 hover:text-kumite-red-500 transition-colors text-sm leading-none
                                               disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-purple-400"
                                  >&times;</button>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">No categories yet. Add one above.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {tournaments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => set_page('competitors')}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all"
            >
              Next: Add Competitors →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
