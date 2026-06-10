import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function QuickMatch() {
  const { start_quick_match } = useAppContext();

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <span className="text-white font-score text-2xl font-bold">⚡</span>
          </div>
          <h1 className="text-3xl font-score font-bold text-gray-900 tracking-tight">Quick Match</h1>
          <p className="text-gray-500 mt-2">Start an informal match without tournament setup</p>
        </div>

        <div className="card p-8">
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* AO Side */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-kumite-blue-100 border-2 border-kumite-blue-300 flex items-center justify-center mb-3">
                <span className="text-3xl font-score font-bold text-kumite-blue-700">AO</span>
              </div>
              <div className="text-sm font-semibold text-kumite-blue-700">Blue</div>
            </div>

            <div className="text-3xl font-score font-bold text-gray-300">VS</div>

            {/* AKA Side */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-kumite-red-100 border-2 border-kumite-red-300 flex items-center justify-center mb-3">
                <span className="text-3xl font-score font-bold text-kumite-red-700">AKA</span>
              </div>
              <div className="text-sm font-semibold text-kumite-red-700">Red</div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              No names or categories required
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Full scoring, timer & penalties
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Syncs with spectator display
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              Results not saved to tournament
            </div>
          </div>

          <button
            onClick={start_quick_match}
            className="w-full py-4 rounded-2xl bg-gray-900 text-white font-score font-bold text-lg
                       hover:bg-gray-800 transition-all active:scale-[0.98] shadow-xl"
          >
            HAJIME — Start Match
          </button>
        </div>
      </div>
    </div>
  );
}
