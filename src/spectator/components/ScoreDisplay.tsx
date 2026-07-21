import React from 'react';
import { MatchScore, Side } from '../../types/score';

interface ScoreDisplayProps {
  total: number;
  score: MatchScore;
  side: Side;
  has_zenshu: boolean;
}

export default function ScoreDisplay({ total, score, side, has_zenshu }: ScoreDisplayProps) {
  const ippon = side === 'blue' ? score.blue_ippon : score.red_ippon;
  const waza = side === 'blue' ? score.blue_waza_ari : score.red_waza_ari;
  const yuko = side === 'blue' ? score.blue_yuko : score.red_yuko;
  const flags = (side === 'blue' ? score.blue_flags : score.red_flags) || 0;

  const breakdown = [
    { label: 'Ippon', value: ippon, accent: false },
    { label: 'Waza-ari', value: waza, accent: false },
    { label: 'Yuko', value: yuko, accent: false },
    ...(flags > 0 ? [{ label: 'Flags', value: flags, accent: true }] : []),
  ];

  return (
    // A compact group: the circle and its breakdown sit directly together and
    // are positioned by the panel, rather than stretching to fill it — which
    // would push the breakdown down to the bottom edge.
    <div className="flex flex-col items-center gap-[2vh] min-h-0 shrink">
      <div className="w-full flex items-center justify-center min-h-0">
        <div
          className="relative flex items-center justify-center min-h-0"
          style={{ height: 'min(30vh, 21vw)', aspectRatio: '1', maxHeight: '100%' }}
        >
          <div
            className={`w-full h-full flex items-center justify-center rounded-full transition-all
              ${has_zenshu
                ? 'border-[0.8vh] border-yellow-400 shadow-[0_0_6vh_rgba(250,204,21,0.55)] bg-white/5'
                : 'border-[0.5vh] border-white/20 bg-white/5'}`}
            // Container units let the number track the circle exactly, so it
            // stays proportional at any size.
            style={{ containerType: 'size' }}
          >
            <span className="font-score font-bold text-white leading-none drop-shadow-2xl"
                  style={{ fontSize: '62cqh' }}>
              {total}
            </span>
          </div>

          {has_zenshu && (
            <div className="absolute -bottom-[1.2vh] left-1/2 -translate-x-1/2 px-[1.4vw] py-[0.4vh]
                            rounded-full bg-yellow-400 text-gray-900 font-bold uppercase
                            tracking-[0.25em] shadow-lg whitespace-nowrap"
                 style={{ fontSize: 'min(2vh, 1.5vw)' }}>
              Senshu
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-[2.5vw] text-white/70 shrink-0">
        {breakdown.map(item => (
          <div key={item.label} className="text-center">
            <div className={`font-score font-bold leading-none
              ${item.accent ? 'text-yellow-300' : 'text-white'}`}
                 style={{ fontSize: 'min(3.6vh, 2.7vw)' }}>
              {item.value}
            </div>
            <div className={`uppercase tracking-[0.2em] mt-[0.4vh]
              ${item.accent ? 'text-yellow-300/80' : 'text-white/60'}`}
                 style={{ fontSize: 'min(1.6vh, 1.2vw)' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
