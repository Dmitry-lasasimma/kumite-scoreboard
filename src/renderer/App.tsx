import React from 'react';
import { AppProvider, useAppContext, Page } from './context/AppContext';
import Home from './pages/Home';
import CompetitorRegistration from './pages/CompetitorRegistration';
import TournamentSetup from './pages/TournamentSetup';
import BracketView from './pages/BracketView';
import BracketDetailView from './pages/BracketDetailView';
import MatchScoring from './pages/MatchScoring';
import QuickMatch from './pages/QuickMatch';
import About from './pages/About';

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'tournament_setup', label: 'Tournaments' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'bracket', label: 'Bracket' },
  { key: 'quick_match', label: 'Quick Match' },
  { key: 'about', label: 'About' },
];

function open_spectator_window() {
  try {
    const kumite = (window as any).kumiteAPI;
    if (kumite) {
      kumite.send('open-spectator', {});
      return;
    }
  } catch {}
  // Fallback: open spectator in a new browser tab (dev mode)
  window.open('/spectator.html', '_blank', 'width=1280,height=720');
}

function AppContent() {
  const { page, set_page, match_status, current_match } = useAppContext();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => set_page('home')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
            <span className="text-white font-score text-sm font-bold">K</span>
          </div>
          <h1 className="font-bold text-lg text-gray-900 tracking-tight">Kumite Scoreboard</h1>
        </button>
        <nav className="flex items-center gap-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => set_page(item.key)}
              className={`nav-tab ${
                page === item.key || (item.key === 'bracket' && page === 'bracket_detail')
                  ? 'nav-tab-active'
                  : 'nav-tab-inactive'
              } ${item.key === 'quick_match' ? 'border border-gray-200' : ''}`}
            >
              {item.key === 'quick_match' && <span className="mr-1">⚡</span>}
              {item.label}
            </button>
          ))}
          {current_match && page !== 'scoring' && (
            <button
              onClick={() => set_page('scoring')}
              className={`nav-tab text-white ${
                match_status === 'active'
                  ? 'bg-kumite-red-500 hover:bg-kumite-red-600 animate-pulse'
                  : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              {match_status === 'active' ? 'Live Match' : 'Back to Match'}
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Spectator Display button */}
          <button
            onClick={open_spectator_window}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                       bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            title="Open Spectator Display"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Spectator</span>
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        {page === 'home' && <Home />}
        {page === 'tournament_setup' && <TournamentSetup />}
        {page === 'competitors' && <CompetitorRegistration />}
        {page === 'bracket' && <BracketView />}
        {page === 'bracket_detail' && <BracketDetailView />}
        {page === 'scoring' && <MatchScoring />}
        {page === 'quick_match' && <QuickMatch />}
        {page === 'about' && <About />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
