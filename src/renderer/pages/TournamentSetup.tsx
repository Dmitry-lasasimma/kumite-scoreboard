import React, { useState, useCallback } from 'react';
import { Tournament, TournamentCategory, PairingConstraint } from '../../types/tournament';
import { useAppContext } from '../context/AppContext';
import { v4 as uuid } from 'uuid';

const CONSTRAINT_OPTIONS: { value: PairingConstraint; label: string; desc: string }[] = [
  { value: 'open', label: 'Open', desc: 'No constraints — any competitor can face any other' },
  { value: 'same_weight', label: 'Same Weight', desc: 'Competitors face others in the same weight class' },
  { value: 'same_age', label: 'Same Age', desc: 'Competitors face others in the same age group' },
  { value: 'both', label: 'Weight & Age', desc: 'Match by both weight and age category' },
];

export default function TournamentSetup() {
  const { tournaments, add_tournament, update_tournament, delete_tournament, set_page, tournament_competitors } = useAppContext();
  const [name, set_name] = useState('');
  const [constraint, set_constraint] = useState<PairingConstraint>('open');
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

  const handle_create = useCallback(() => {
    if (!name.trim()) return;
    const tournament: Tournament = {
      id: uuid(),
      name: name.trim(),
      pairing_constraint: constraint,
      categories,
      status: 'pending',
    };
    add_tournament(tournament);
    set_name('');
    set_constraint('open');
    set_categories([]);
  }, [name, constraint, categories, add_tournament]);

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

  /** Remove a category from an existing tournament */
  const handle_remove_edit_category = useCallback((tid: string, cat_id: string) => {
    const t = tournaments.find(x => x.id === tid);
    if (!t) return;
    update_tournament({ ...t, categories: (t.categories || []).filter(c => c.id !== cat_id) });
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pairing Constraint</label>
              <div className="space-y-2">
                {CONSTRAINT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set_constraint(opt.value)}
                    className={`w-full p-3 rounded-xl text-left transition-all border-2
                      ${constraint === opt.value
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Categories (optional)</label>
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
            className="w-full mt-6 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm
                       hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg"
          >
            Create Tournament
          </button>
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
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold capitalize">
                            {t.pairing_constraint.replace('_', ' ')}
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
                          {is_editing ? 'Done' : 'Edit Categories'}
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

                    {/* Edit categories panel */}
                    {is_editing && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
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
                            {t.categories.map(cat => (
                              <span key={cat.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">
                                {cat.name}
                                <button
                                  onClick={() => handle_remove_edit_category(t.id, cat.id)}
                                  className="text-purple-400 hover:text-kumite-red-500 transition-colors text-sm leading-none"
                                >&times;</button>
                              </span>
                            ))}
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
