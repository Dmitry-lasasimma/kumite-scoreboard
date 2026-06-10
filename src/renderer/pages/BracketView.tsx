import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { TournamentCategory } from '../../types/tournament';

export default function BracketView() {
  const {
    tournaments, matches, competitors, tournament_competitors,
    generate_tournament_bracket, generate_category_bracket,
    get_competitor, set_page,
    selected_tournament_id, set_selected_tournament_id,
    set_selected_category_id,
  } = useAppContext();

  const [local_selected, set_local_selected] = useState<string>(selected_tournament_id || tournaments[0]?.id || '');
  const [filter_cat, set_filter_cat] = useState<string>('all');

  const selected = local_selected || '';
  const tournament = tournaments.find(t => t.id === selected);
  const comp_ids = tournament_competitors[selected] || [];
  const all_comps = comp_ids.map(id => get_competitor(id)).filter(Boolean) as typeof competitors;
  const has_categories = tournament?.categories && tournament.categories.length > 0;
  const categories: TournamentCategory[] = tournament?.categories || [];

  /** Group competitors by category */
  const grouped = useMemo(() => {
    const groups: { category_id: string | null; category_name: string; comps: typeof competitors }[] = [];

    if (has_categories) {
      for (const cat of categories) {
        const cat_comps = all_comps.filter(c => c.category_id === cat.id);
        groups.push({ category_id: cat.id, category_name: cat.name, comps: cat_comps });
      }
      // Unassigned competitors
      const unassigned = all_comps.filter(c => !c.category_id || !categories.some(cat => cat.id === c.category_id));
      if (unassigned.length > 0) {
        groups.push({ category_id: null, category_name: 'Unassigned', comps: unassigned });
      }
    } else {
      groups.push({ category_id: null, category_name: 'All Competitors', comps: all_comps });
    }

    return groups;
  }, [all_comps, categories, has_categories]);

  /** Filter groups */
  const displayed_groups = filter_cat === 'all'
    ? grouped
    : grouped.filter(g => g.category_id === filter_cat || (filter_cat === 'none' && g.category_id === null));

  const handle_select_tournament = (id: string) => {
    set_local_selected(id);
    set_selected_tournament_id(id);
    set_filter_cat('all');
  };

  /** Get match stats for a category */
  const get_category_stats = (category_id: string | null) => {
    const cat_matches = matches.filter(m => m.tournament_id === selected && m.category_id === category_id);
    const total = cat_matches.length;
    const completed = cat_matches.filter(m => m.status === 'completed').length;
    const in_progress = cat_matches.filter(m => m.status === 'in_progress').length;
    return { total, completed, in_progress, has_bracket: total > 0 };
  };

  const handle_generate = (category_id: string | null) => {
    if (!selected) return;
    if (category_id) {
      generate_category_bracket(selected, category_id);
    } else {
      generate_tournament_bracket(selected);
    }
  };

  const handle_view_bracket = (category_id: string | null) => {
    set_selected_tournament_id(selected);
    set_selected_category_id(category_id);
    set_page('bracket_detail');
  };

  if (tournaments.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card p-12 text-center text-gray-400 max-w-md">
          <div className="text-4xl mb-3">🏆</div>
          <div className="font-semibold text-lg">No tournaments created</div>
          <div className="text-sm mt-1 mb-4">Create a tournament and add competitors first</div>
          <button onClick={() => set_page('tournament_setup')}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
            Create Tournament
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">Tournament Bracket</h2>
          <select
            value={selected}
            onChange={e => handle_select_tournament(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Generate all (only when no categories) */}
        {!has_categories && all_comps.length >= 2 && (
          <button onClick={() => handle_generate(null)}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg">
            {get_category_stats(null).has_bracket ? 'Regenerate Bracket' : 'Generate Bracket'}
          </button>
        )}
      </div>

      {/* Category filter */}
      {has_categories && (
        <div className="flex items-center gap-2 mb-4 shrink-0 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter:</span>
          <button
            onClick={() => set_filter_cat('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${filter_cat === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => set_filter_cat(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${filter_cat === cat.id ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Category groups as rows */}
      <div className="flex-1 overflow-auto">
        {all_comps.length < 2 ? (
          <div className="card p-8 text-center text-gray-400">
            <div className="font-semibold">Not enough competitors</div>
            <div className="text-sm mt-1 mb-3">Add at least 2 competitors to this tournament</div>
            <button onClick={() => set_page('competitors')}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all">
              Add Competitors
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed_groups.map(group => {
              const stats = get_category_stats(group.category_id);
              const can_generate = group.comps.length >= 2;

              return (
                <div key={group.category_id || 'unassigned'} className="card overflow-hidden">
                  {/* Group header */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${group.category_id ? 'bg-purple-500' : 'bg-gray-300'}`} />
                      <div>
                        <h3 className="font-bold text-gray-900">{group.category_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{group.comps.length} competitors</span>
                          {stats.has_bracket && (
                            <>
                              <span className="text-xs text-gray-300">|</span>
                              <span className="text-xs text-green-600 font-semibold">{stats.completed}/{stats.total} matches</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {stats.has_bracket && (
                        <button onClick={() => handle_view_bracket(group.category_id)}
                          className="px-4 py-2 rounded-xl bg-kumite-blue-50 text-kumite-blue-700 font-semibold text-sm hover:bg-kumite-blue-100 transition-all">
                          View Bracket
                        </button>
                      )}
                      {can_generate && (
                        <button onClick={() => handle_generate(group.category_id)}
                          className="px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all active:scale-[0.98]">
                          {stats.has_bracket ? 'Regenerate' : 'Generate Bracket'}
                        </button>
                      )}
                      {!can_generate && group.comps.length < 2 && (
                        <span className="px-4 py-2 text-xs text-gray-400 font-semibold">Need 2+ competitors</span>
                      )}
                    </div>
                  </div>

                  {/* Competitor rows */}
                  <div className="divide-y divide-gray-50">
                    {group.comps.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400 text-center">
                        No competitors assigned to this category
                      </div>
                    ) : (
                      group.comps.map((c, idx) => (
                        <div key={c.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-all">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-300 w-5 text-right">{idx + 1}</span>
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs">
                              {c.first_name[0]}{c.last_name[0]}
                            </div>
                            <div>
                              <span className="font-semibold text-sm text-gray-900">{c.first_name} {c.last_name}</span>
                              <span className="text-xs text-gray-400 ml-2">{c.club}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.weight_category && (
                              <span className="px-2 py-0.5 rounded bg-kumite-blue-50 text-kumite-blue-700 text-[10px] font-semibold">{c.weight_category}</span>
                            )}
                            {c.age_category && (
                              <span className="px-2 py-0.5 rounded bg-kumite-red-50 text-kumite-red-700 text-[10px] font-semibold">{c.age_category}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
