import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function Home() {
  const { set_page, tournaments, competitors, matches } = useAppContext();

  const active_tournaments = tournaments.filter(t => t.status === 'in_progress');
  const total_matches = matches.filter(m => m.status === 'completed').length;

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <span className="text-white font-score text-3xl font-bold">K</span>
          </div>
          <h1 className="text-4xl font-score font-bold text-gray-900 tracking-tight">Kumite Scoreboard</h1>
          <p className="text-gray-500 mt-2 text-lg">Tournament Management & Live Scoring</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card p-5 text-center">
            <div className="text-3xl font-score font-bold text-gray-900">{tournaments.length}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Tournaments</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-score font-bold text-gray-900">{competitors.length}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Competitors</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-score font-bold text-gray-900">{total_matches}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Matches Played</div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Get Started</h2>
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => set_page('tournament_setup')}
              className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-kumite-blue-100 text-kumite-blue-700 flex items-center justify-center font-bold text-sm mb-2">1</div>
              <div className="font-semibold text-sm text-gray-900">Create Tournament</div>
              <div className="text-xs text-gray-400 mt-0.5">Set up event & rules</div>
            </button>
            <button
              onClick={() => set_page('competitors')}
              className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-kumite-blue-100 text-kumite-blue-700 flex items-center justify-center font-bold text-sm mb-2">2</div>
              <div className="font-semibold text-sm text-gray-900">Add Competitors</div>
              <div className="text-xs text-gray-400 mt-0.5">Register & assign</div>
            </button>
            <button
              onClick={() => set_page('bracket')}
              className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-kumite-red-100 text-kumite-red-700 flex items-center justify-center font-bold text-sm mb-2">3</div>
              <div className="font-semibold text-sm text-gray-900">Generate Bracket</div>
              <div className="text-xs text-gray-400 mt-0.5">Random pairings</div>
            </button>
            <button
              onClick={() => set_page('bracket')}
              className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm mb-2">4</div>
              <div className="font-semibold text-sm text-gray-900">Start Matches</div>
              <div className="text-xs text-gray-400 mt-0.5">Score & manage</div>
            </button>
          </div>
        </div>

        {/* Quick Match */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Quick Match</h2>
              <p className="text-sm text-gray-500">Start an informal AO vs AKA match — no setup needed</p>
            </div>
            <button
              onClick={() => set_page('quick_match')}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <span>⚡</span> Quick Match
            </button>
          </div>
        </div>

        {/* Active Tournaments */}
        {active_tournaments.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Tournaments</h2>
            <div className="space-y-2">
              {active_tournaments.map(t => {
                const t_matches = matches.filter(m => m.tournament_id === t.id);
                const completed = t_matches.filter(m => m.status === 'completed').length;
                return (
                  <button
                    key={t.id}
                    onClick={() => { set_page('bracket'); }}
                    className="w-full p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-400">{completed}/{t_matches.length} matches completed</div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">In Progress</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
