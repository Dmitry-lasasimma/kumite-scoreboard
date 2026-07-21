import React, { useState } from 'react';
import {
  APP_NAME, APP_VERSION, APP_TAGLINE, APP_AUTHOR, APP_CONTACT_EMAIL, APP_COPYRIGHT,
} from '../../utils/constants';
import { LICENSE_TEXT } from '../data/license_text';

interface Feature {
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Competitor Registration',
    desc: 'Maintain a roster of athletes with name, club, and weight/age categories, reused across every tournament.',
  },
  {
    title: 'Tournament Brackets',
    desc: 'Generate single-elimination brackets per category, with automatic BYE handling and a choice of one or two 3rd places.',
  },
  {
    title: 'Live Match Scoring',
    desc: 'A focused operator console for Yuko, Waza-ari and Ippon, penalties, a flexible round timer, and full Senshu (first-point advantage) tracking.',
  },
  {
    title: 'Spectator Display',
    desc: 'A second, arena-ready screen that mirrors the operator in real time — large scores, timer, penalties and the Senshu indicator.',
  },
  {
    title: 'Manual Bracket Editing',
    desc: 'Drag competitors between slots, substitute athletes, adjust scores, and set winners by hand to keep full control of the draw.',
  },
  {
    title: 'PDF Export',
    desc: 'Preview and export a printable tournament bracket and a final results sheet with podium standings and per-match detail.',
  },
];

export default function About() {
  const [show_license, set_show_license] = useState(false);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Hero */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <span className="text-white font-score text-2xl font-bold">K</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{APP_NAME}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold font-score">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-gray-500 mt-0.5">{APP_TAGLINE}</p>
          </div>
        </div>

        {/* Purpose */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">About this program</h2>
          <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>
              {APP_NAME} is a cross-platform desktop application built to run Karate kumite competitions
              from a single machine — from registering competitors and drawing the bracket, through scoring
              every match live, to publishing the final results. It is designed for table officials and
              tournament organizers who need reliable, distraction-free control during a real event.
            </p>
            <p>
              The application separates the two roles of a scoring table into two synchronized windows. The
              operator console gives the table judge precise control over scores, penalties, and the match
              clock, while a full-screen spectator display shows competitors, live scores, the timer, and the
              Senshu advantage to the audience and athletes. Both stay in sync in real time, so what the
              operator records is instantly reflected on the arena screen.
            </p>
            <p>
              Kumite scoring is implemented faithfully: points are awarded as Yuko (1), Waza-ari (2), and
              Ippon (3); an eight-point lead signals a decisive advantage; penalties escalate from Chukoku
              through Hansoku-Chui to Hansoku and Shikkaku; and Senshu (first unopposed point) is tracked as
              the tie-breaker when the score is level. The referee always retains final authority — the match
              only ends when the operator confirms it, allowing time to be added or a decision to be reviewed.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">What it does</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="card p-4">
                <div className="font-semibold text-gray-900 text-sm mb-1">{f.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* License */}
        <section className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">License</h2>
            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
              Proprietary — End-User License Agreement
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {APP_NAME} is proprietary software licensed, not sold. Use is governed by the End-User License
            Agreement (EULA). In summary, You are granted a limited, personal, non-transferable license to
            install and use the Software for running Karate kumite competitions. The following are the key
            terms — the full agreement is authoritative.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {[
              'A license to use — ownership stays with the developer.',
              'No reselling, redistribution, or hosting of the Software.',
              'No modifying, reverse-engineering, or derivative works.',
              'Attribution and copyright notices must be kept intact.',
              'Provided "as is", without warranty of any kind.',
              'Liability is limited to the maximum extent permitted by law.',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => set_show_license(v => !v)}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all"
          >
            {show_license ? 'Hide full license' : 'Read full End-User License Agreement'}
          </button>

          {show_license && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 max-h-96 overflow-auto">
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600 font-sans">
                {LICENSE_TEXT}
              </pre>
            </div>
          )}
        </section>

        {/* Credit / contact */}
        <section className="card p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Developer</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Created, designed, and developed by{' '}
              <span className="font-semibold text-gray-900">{APP_AUTHOR}</span>.
            </div>
            <div>
              Contact:{' '}
              <a href={`mailto:${APP_CONTACT_EMAIL}`} className="text-kumite-blue-600 hover:underline">
                {APP_CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        <div className="text-center text-xs text-gray-400 pb-6">
          {APP_NAME}™ — developed by {APP_AUTHOR}. {APP_COPYRIGHT}
        </div>
      </div>
    </div>
  );
}
