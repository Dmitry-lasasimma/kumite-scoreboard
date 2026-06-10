import React, { useState, useCallback, useMemo } from 'react';
import { Competitor, WeightCategory, AgeCategory } from '../../types/competitor';
import { TournamentCategory } from '../../types/tournament';
import { validate_competitor } from '../../utils/validators';
import { useAppContext } from '../context/AppContext';
import { v4 as uuid } from 'uuid';

const WEIGHT_OPTIONS: WeightCategory[] = ['Light', 'Medium', 'Heavy'];
const AGE_OPTIONS: AgeCategory[] = ['U12', 'U16', 'U21', 'Senior'];

export default function CompetitorRegistration() {
  const {
    competitors, add_competitor, update_competitor, delete_competitor,
    tournaments, tournament_competitors,
    add_competitor_to_tournament, remove_competitor_from_tournament,
    set_page,
  } = useAppContext();

  const [first_name, set_first_name] = useState('');
  const [last_name, set_last_name] = useState('');
  const [club, set_club] = useState('');
  const [weight, set_weight] = useState<WeightCategory | ''>('');
  const [age, set_age] = useState<AgeCategory | ''>('');
  const [category_id, set_category_id] = useState<string>('');
  const [selected_tournament, set_selected_tournament] = useState<string>(tournaments[0]?.id || '');
  const [errors, set_errors] = useState<string[]>([]);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [search, set_search] = useState('');
  const [filter_category, set_filter_category] = useState<string>('all');

  /** All categories from the selected tournament */
  const available_categories: TournamentCategory[] = useMemo(() => {
    const t = tournaments.find(t => t.id === selected_tournament);
    return t?.categories || [];
  }, [selected_tournament, tournaments]);

  /** All categories across all tournaments for the filter */
  const all_categories: TournamentCategory[] = useMemo(() => {
    const seen = new Set<string>();
    const cats: TournamentCategory[] = [];
    for (const t of tournaments) {
      for (const c of (t.categories || [])) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          cats.push(c);
        }
      }
    }
    return cats;
  }, [tournaments]);

  const reset_form = useCallback(() => {
    set_first_name('');
    set_last_name('');
    set_club('');
    set_weight('');
    set_age('');
    set_category_id('');
    set_errors([]);
    set_editing_id(null);
  }, []);

  const handle_submit = useCallback(() => {
    const data: Partial<Competitor> = { first_name, last_name, club };
    const validation_errors = validate_competitor(data);
    if (validation_errors.length > 0) { set_errors(validation_errors); return; }

    if (editing_id) {
      update_competitor({
        id: editing_id, first_name, last_name, club,
        weight_category: weight || null,
        age_category: age || null,
        category_id: category_id || null,
      });
    } else {
      const new_competitor: Competitor = {
        id: uuid(), first_name, last_name, club,
        weight_category: weight || null,
        age_category: age || null,
        category_id: category_id || null,
      };
      add_competitor(new_competitor);
      if (selected_tournament) {
        add_competitor_to_tournament(selected_tournament, new_competitor.id);
      }
    }
    reset_form();
  }, [first_name, last_name, club, weight, age, category_id, editing_id, selected_tournament,
      add_competitor, update_competitor, add_competitor_to_tournament, reset_form]);

  const handle_edit = useCallback((c: Competitor) => {
    set_first_name(c.first_name);
    set_last_name(c.last_name);
    set_club(c.club);
    set_weight(c.weight_category || '');
    set_age(c.age_category || '');
    set_category_id(c.category_id || '');
    set_editing_id(c.id);
  }, []);

  const handle_delete = useCallback((id: string) => {
    delete_competitor(id);
    if (editing_id === id) reset_form();
  }, [editing_id, delete_competitor, reset_form]);

  const is_in_tournament = (cid: string, tid: string) => (tournament_competitors[tid] || []).includes(cid);

  const toggle_tournament = useCallback((cid: string, tid: string) => {
    if (is_in_tournament(cid, tid)) {
      remove_competitor_from_tournament(tid, cid);
    } else {
      add_competitor_to_tournament(tid, cid);
    }
  }, [tournament_competitors, add_competitor_to_tournament, remove_competitor_from_tournament]);

  /** Get category name by id */
  const get_category_name = useCallback((cat_id: string | null): string => {
    if (!cat_id) return '';
    for (const t of tournaments) {
      const cat = (t.categories || []).find(c => c.id === cat_id);
      if (cat) return cat.name;
    }
    return '';
  }, [tournaments]);

  const filtered = competitors.filter(c => {
    const q = search.toLowerCase();
    const match_search = !q || `${c.first_name} ${c.last_name} ${c.club}`.toLowerCase().includes(q);
    const match_category = filter_category === 'all'
      || (filter_category === 'none' && !c.category_id)
      || c.category_id === filter_category;
    return match_search && match_category;
  });

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* Form */}
      <div className="w-96 shrink-0">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">
            {editing_id ? 'Edit Competitor' : 'Add Competitor'}
          </h2>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-kumite-red-50 border border-kumite-red-200 rounded-xl text-kumite-red-700 text-sm">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div className="space-y-4">
            {!editing_id && tournaments.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Assign to Tournament</label>
                <select
                  value={selected_tournament}
                  onChange={e => { set_selected_tournament(e.target.value); set_category_id(''); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm bg-white"
                >
                  <option value="">No tournament</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {tournaments.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
                No tournaments created yet.{' '}
                <button onClick={() => set_page('tournament_setup')} className="underline font-semibold">
                  Create one first
                </button>
              </div>
            )}

            {/* Category selector */}
            {available_categories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {available_categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => set_category_id(category_id === cat.id ? '' : cat.id)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all
                        ${category_id === cat.id
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
                <input value={first_name} onChange={e => set_first_name(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm"
                  placeholder="First name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
                <input value={last_name} onChange={e => set_last_name(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm"
                  placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Club</label>
              <input value={club} onChange={e => set_club(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all text-sm"
                placeholder="Club name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Weight Category</label>
              <div className="flex gap-2">
                {WEIGHT_OPTIONS.map(w => (
                  <button key={w} onClick={() => set_weight(weight === w ? '' : w)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                      ${weight === w ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Age Category</label>
              <div className="flex gap-2">
                {AGE_OPTIONS.map(a => (
                  <button key={a} onClick={() => set_age(age === a ? '' : a)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                      ${age === a ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={handle_submit}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg">
              {editing_id ? 'Update' : 'Add Competitor'}
            </button>
            {editing_id && (
              <button onClick={reset_form} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-all">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Competitors <span className="text-gray-400 font-normal text-base ml-1">({competitors.length})</span>
          </h2>
          <input value={search} onChange={e => set_search(e.target.value)} placeholder="Search..."
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm w-64 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
        </div>

        {/* Category filter */}
        {all_categories.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter:</span>
            <button
              onClick={() => set_filter_category('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${filter_category === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            {all_categories.map(cat => (
              <button key={cat.id} onClick={() => set_filter_category(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                  ${filter_category === cat.id ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => set_filter_category('none')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${filter_category === 'none' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              No Category
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">👤</div>
              <div className="font-semibold">{competitors.length === 0 ? 'No competitors yet' : 'No matches found'}</div>
              <div className="text-sm mt-1">{competitors.length === 0 ? 'Add competitors using the form' : 'Try a different search'}</div>
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map(c => (
                <div key={c.id} className="card px-5 py-3.5 flex items-center justify-between group hover:shadow-lg transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm">
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{c.first_name} {c.last_name}</div>
                      <div className="text-xs text-gray-400">{c.club}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.category_id && (
                      <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold">
                        {get_category_name(c.category_id)}
                      </span>
                    )}
                    {c.weight_category && (
                      <span className="px-2 py-0.5 rounded-lg bg-kumite-blue-50 text-kumite-blue-700 text-xs font-semibold">{c.weight_category}</span>
                    )}
                    {c.age_category && (
                      <span className="px-2 py-0.5 rounded-lg bg-kumite-red-50 text-kumite-red-700 text-xs font-semibold">{c.age_category}</span>
                    )}
                    {/* Tournament badges */}
                    {tournaments.map(t => {
                      const in_t = is_in_tournament(c.id, t.id);
                      return (
                        <button key={t.id} onClick={() => toggle_tournament(c.id, t.id)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all
                            ${in_t ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          title={in_t ? `Remove from ${t.name}` : `Add to ${t.name}`}>
                          {t.name.substring(0, 12)}{in_t ? ' ✓' : ''}
                        </button>
                      );
                    })}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button onClick={() => handle_edit(c)} className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all">Edit</button>
                      <button onClick={() => handle_delete(c.id)} className="px-2 py-1 rounded-lg bg-kumite-red-50 text-kumite-red-600 text-xs font-semibold hover:bg-kumite-red-100 transition-all">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {competitors.length >= 2 && tournaments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button onClick={() => set_page('bracket')}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
              Next: Generate Bracket →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
